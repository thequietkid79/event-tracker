import express from 'express';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import fs from 'fs';

const app = express();
const port = 3000;

const keywordsDataPath = './keywords.json';
const subscribersDataPath = './subscribers.json';

function initializeKeywordsFile() {
  if (!fs.existsSync(keywordsDataPath)) {
    fs.writeFileSync(keywordsDataPath, '[]');
  }
}

function initializeSubscribersFile() {
  if (!fs.existsSync(subscribersDataPath)) {
    fs.writeFileSync(subscribersDataPath, '[]');
  }
}

initializeKeywordsFile();
initializeSubscribersFile();

let keywordsData = JSON.parse(fs.readFileSync(keywordsDataPath, 'utf8'));
let subscribersData = JSON.parse(fs.readFileSync(subscribersDataPath, 'utf8'));

async function scrapeKeywords(keyword, source) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    let baseUrl = '';
    switch (source) {
      case 'example':
        baseUrl = 'https://www.example.com/search?q=';
        break;
      // Add cases for other sources as needed

      default:
        console.error('Invalid source:', source);
        return false;
    }

    await page.goto(baseUrl + keyword);
    const articles = await page.$$('.article');

    let newKeywords = false;
    for (const article of articles) {
      const title = await article.$eval('.title', element => element.textContent);
      const summary = await article.$eval('.summary', element => element.textContent);
      const url = await article.$eval('.link', element => element.getAttribute('href'));

      const existingKeywordIndex = keywordsData.findIndex(keywordData => keywordData.keyword === keyword);
      if (existingKeywordIndex === -1) {
        newKeywords = true;
        keywordsData.push({ keyword, source, urls: [url], summary });
      } else {
        const existingKeyword = keywordsData[existingKeywordIndex];
        if (!existingKeyword.urls.includes(url)) {
          newKeywords = true;
          existingKeyword.urls.push(url);
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
    console.error(`Error during web scraping for keyword '${keyword}' and source '${source}':`, err);
    return false; // Indicate scraping error
  } finally {
    await browser.close();
  }
}

async function sendEmails(keyword, source, subscribers) {
  for (const subscriber of subscribers) {
    const emailOptions = {
      from: '"Your Name" <your-email@example.com>',
      to: subscriber.email,
      subject: 'Update Alert',
      text: `New or updated information found for your search topic (${keyword}) from source (${source}).`,
    };

    try {
      await nodemailer.createTransport({
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        auth: {
          user: 'your-email@example.com',
          pass: 'your-password',
        },
      }).sendMail(emailOptions);

      console.log('Email sent to:', subscriber.email);
    } catch (err) {
      console.error('Error sending email:', err);
    }
  }
}

async function sendDigestEmail(email, updates) {
  const emailOptions = {
    from: '"Your Name" <your-email@example.com>',
    to: email,
    subject: 'Digest Update Alert',
    text: `Here is your digest of updates:\n\n${updates.join('\n\n')}`,
  };

  try {
    await nodemailer.createTransport({
      host: 'smtp.example.com',
      port: 587,
      secure: true,
      auth: {
        user: 'your-email@example.com',
        pass: 'your-password',
      },
    }).sendMail(emailOptions);

    console.log('Digest Email sent to:', email);
  } catch (err) {
    console.error('Error sending digest email:', err);
  }
}

async function fetchUpdates(keywords, sources, lastDigestSent) {
  const updates = [];

  const allUpdates = [
    { timestamp: 1637762400000, keyword: 'example', source: 'example.com', update: 'New information 1.' },
    { timestamp: 1637763000000, keyword: 'example', source: 'example.org', update: 'New information 2.' },
    // ... add more updates as needed
  ];

  const filteredUpdates = allUpdates.filter(update => {
    return (
      keywords.includes(update.keyword) &&
      sources.includes(update.source) &&
      update.timestamp > lastDigestSent
    );
  });

  filteredUpdates.forEach(update => {
    updates.push(`${update.source}: ${update.update}`);
  });

  return updates;
}

app.use(express.json());

app.post('/keywords', async (req, res) => {
  const { keyword, email, source, digestInterval } = req.body;

  try {
    keywordsData.push({ keyword, source, urls: [] });
    subscribersData.push({ email, keywords: [keyword], sources: [source], lastDigestSent: Date.now(), digestInterval });

    const newKeywordsFound = await scrapeKeywords(keyword, source);

    const subscribers = subscribersData.filter(subscriberData =>
      subscriberData.keywords.includes(keyword) && subscriberData.sources.includes(source)
    );

    if (newKeywordsFound && subscribers.length > 0) {
      await sendEmails(keyword, source, subscribers);
    }

    fs.writeFileSync(keywordsDataPath, JSON.stringify(keywordsData, null, 2));
    fs.writeFileSync(subscribersDataPath, JSON.stringify(subscribersData, null, 2));

    res.status(200).json({ message: 'Keyword added successfully' });
  } catch (err) {
    console.error('Error adding keyword:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

setInterval(async () => {
  try {
    for (const subscriber of subscribersData) {
      const { email, keywords, sources, lastDigestSent, digestInterval } = subscriber;

      if (Date.now() - lastDigestSent >= digestInterval) {
        const updates = await fetchUpdates(keywords, sources, lastDigestSent);

        if (updates.length > 0) {
          await sendDigestEmail(email, updates);
          subscriber.lastDigestSent = Date.now();
        }
      }
    }
  } catch (err) {
    console.error('Error in the background task:', err);
  }
}, 60 * 60 * 1000);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
