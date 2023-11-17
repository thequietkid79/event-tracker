import express from 'express';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import fs from 'fs';
import bodyParser from 'body-parser';

const app = express();
const port = 3000;
app.use(bodyParser.urlencoded({ extended: true }));


// Paths for storing data files 
const keywordsDataPath = './keywords.json';
const subscribersDataPath = './subscribers.json';

// Function to initialize the keywords data file if it doesn't exist
function initializeKeywordsFile() {
  if (!fs.existsSync(keywordsDataPath)) {
    fs.writeFileSync(keywordsDataPath, '[]');
  }
}

// Function to initialize the subscribers data file if it doesn't exist
function initializeSubscribersFile() {
  if (!fs.existsSync(subscribersDataPath)) {
    fs.writeFileSync(subscribersDataPath, '[]');
  }
}

initializeKeywordsFile();
initializeSubscribersFile();

// Read data from the keywords and subscribers files
let keywordsData = JSON.parse(fs.readFileSync(keywordsDataPath, 'utf8'));
let subscribersData = JSON.parse(fs.readFileSync(subscribersDataPath, 'utf8'));

// 
async function scrapeKeywords(keyword) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    let baseUrl = `https://www.espncricinfo.com/cricket-news`;
    

    await page.goto(baseUrl);

    // Adjust these selectors to match the structure of the CNN search results page
    const articles = await page.$$('.ds-p-0');
    const titleSelector = 'ds-text-title-s';
    const summarySelector = 'ds-text-compact-s';
    const urlSelector = 'ds-text-compact-xs';

    let newKeywords = false;
    for (const article of articles) {
      const title = await article.$eval(titleSelector, element => element.textContent);
      const summary = await article.$eval(summarySelector, element => element.textContent);
      const url = await article.$eval(urlSelector, element => element.getAttribute('href'));

      console.log('Title:', title);
      console.log('Summary:', summary);
      console.log('URL:', url);

      const existingKeywordIndex = keywordsData.findIndex(keywordData => keywordData.keyword === keyword);
      if (existingKeywordIndex === -1) {
        newKeywords = true;
        keywordsData.push({ keyword, title, urls: [{ url, addedAt: Date.now() }], summary });
      } else {
        const existingKeyword = keywordsData[existingKeywordIndex];
        if (!existingKeyword.urls.some(u => u.url === url)) {
          newKeywords = true;
          existingKeyword.urls.push({ url, addedAt: Date.now() });
        }
      }
    }

    if (newKeywords) {
      fs.writeFileSync(keywordsDataPath, JSON.stringify(keywordsData, null, 2));
      return true; // Indicate new keywords found
    } else {
      return false; // Indicate no new keywords found
    }
  } catch (err) {
    console.error(`Error during web scraping for keyword '${keyword}':`, err);
    return false; // Indicate scraping error
  } finally {
    await browser.close();
  }
}


async function sendDigestEmail(email, updates) {
  const emailOptions = {
    from: '"Aniket Ghosh" <ghoshaniket1000@gmail.com>',
    to: email,
    subject: 'Digest Update Alert',
    text: `Here is your digest of updates:\n\n${updates.join('\n\n')}`,
  };

  try {
    await nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: true,
      auth: {
        user: 'ghoshaniket1000@gmail.com',
        pass: 'kubernetesismine',
      },
    }).sendMail(emailOptions);

    console.log('Digest Email sent to:', email);
  } catch (err) {
    console.error('Error sending digest email:', err);
  }
}

async function fetchUpdates(keywords, lastDigestSent) {
  const updates = [];

  for (const keyword of keywords) {
    const keywordData = keywordsData.find(kd => kd.keyword === keyword);

    if (keywordData) {
      // Filter the URLs that were added after the last digest was sent
      const newUrls = keywordData.urls.filter(url => url.addedAt > lastDigestSent);

      if (newUrls.length > 0) {
        updates.push({
          keyword,
          urls: newUrls,
        });
      }
    }
  }

  return updates;
}


app.use(express.json());

app.post('/keywords', async (req, res) => {
  const { keyword, email, frequency } = req.body;

  try {
    keywordsData.push({ keyword, urls: [] });
    subscribersData.push({ email, keywords: [keyword], lastDigestSent: Date.now(), frequency });

    const newKeywordsFound = await scrapeKeywords(keyword);

    if (newKeywordsFound) {
      fs.writeFileSync(keywordsDataPath, JSON.stringify(keywordsData, null, 2));
      fs.writeFileSync(subscribersDataPath, JSON.stringify(subscribersData, null, 2));

      res.status(200).json({ message: 'Keyword added successfully' });
    } else {
      res.status(200).json({ message: 'No new keywords found' });
    }
  } catch (err) {
    console.error('Error adding keyword:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


function getFrequencyInterval(frequency) {
  // Define the frequency intervals in milliseconds
  const frequencyIntervals = {
    daily: 24 * 60 * 60 * 1000,     // for 24 hours
    weekly: 7 * 24 * 60 * 60 * 1000, // for 7 days
    monthly: 30 * 24 * 60 * 60 * 1000, // for 30 days (approximate)
  };

  return frequencyIntervals[frequency] || 24 * 60 * 60 * 1000; // Default to daily if frequency is not recognized
}

setInterval(async () => {
  try {
    for (const subscriber of subscribersData) {
      const { email, keywords, lastDigestSent, frequency } = subscriber;

      // Check if the frequency interval has passed since the last email
      if (Date.now() - lastDigestSent >= getFrequencyInterval(frequency)) {
        const updates = await fetchUpdates(keywords, lastDigestSent);

        if (updates.length > 0) {
          await sendDigestEmail(email, updates);
          subscriber.lastDigestSent = Date.now();
        }
      }
    }
  } catch (err) {
    console.error('Error in the background task:', err);
  }
}, 60 * 60 * 1000); // Run every hour


app.use((err, req, res) => {
  console.error('Error:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
