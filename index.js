import express from 'express';
import bodyParser from 'body-parser';
import { google } from 'googleapis';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import axios from 'axios';

const app = express();
app.use(bodyParser.json());

// const GOOGLE_SEARCH_API_KEY = 'AIzaSyBor1ImAyUkZ5kmFw2693BfS9Dn0gWTZB8';
const PALM_API_KEY = 'AIzaSyBqWq0lfhwOGviXAxoTVVpd38e6Zzj7XnI';

const emailFrom = ''; // Replace with your Gmail email address
let emailTo; // Variable to store the recipient email dynamically

const updateStore = {
  updates: [],
};

const cronExpressions = {
  hourly: '0 * * * *',
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
  monthly: '0 9 1 * *',
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'my', // Replace with your Gmail email address
    pass: 'my', // Replace with your Gmail password or an application-specific password
  },
});

async function sendEmail(from, to, subject, text) {
  const mailOptions = {
    from,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully.');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function getSearchResults() {
  // const customsearch = google.customsearch('v1'); // Use the correct Google Custom Search API

  const data  = await axios.get("https://www.googleapis.com/customsearch/v1?key=AIzaSyBor1ImAyUkZ5kmFw2693BfS9Dn0gWTZB8&cx=a60c4c10e04c546d5&q=world-cup");
    // auth: 'AIzaSyBor1ImAyUkZ5kmFw2693BfS9Dn0gWTZB8',
    // cx: 'a60c4c10e04c546d5',
    // q: topic
  const searchResults = data.data.items;
  console.log('Search results:', searchResults);
  return searchResults;

}




async function getInsights(title, snippet) {
  const palmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=${PALM_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        text: title + ' ' + snippet,
      },
    }),
  });

  const palmData = await palmResponse.json();
  const { entities, tags } = palmData;

  return { entities, tags };
}

async function processSearchResults(searchResults) {
  const updates = [];

  for (const searchResult of searchResults) {
    const { title, link, snippet } = searchResult;

    const insights = await getInsights(title, snippet);

    const update = {
      title,
      url: link,
      snippet,
      insights,
    };

    updates.push(update);
  }

  return updates;
}


function formatEmailBody(updates) {
  let emailBody = '';

  for (const update of updates) {
    emailBody += `\n**Title:** ${update.title}\n`;
    emailBody += `**URL:** ${update.url}\n`;
    emailBody += `**Summary:** ${update.summary}\n`;
    emailBody += `**Insights:**\n`;

    for (const entity of update.entities) {
      emailBody += `• ${entity.type}: ${entity.name}\n`;
    }

    for (const tag of update.tags) {
      emailBody += `• ${tag.type}: ${tag.name}\n`;
    }

    emailBody += '\n';
    console.log(emailBody);
  }

  return emailBody;
}

app.post('/search', async (req, res) => {
  const topic = req.body.topic;
  const scheduleOption = req.body.scheduleOption;
  emailTo = req.body.email; // Set the emailTo variable dynamically
  if (!cronExpressions.hasOwnProperty(scheduleOption)) {
    res.json({
      success: false,
      message: `Invalid schedule option: ${scheduleOption}`,
    });
    return;
  }
  
  const cronExpression = cronExpressions[scheduleOption];
  const searchResults = await getSearchResults(topic);
  const updates = await processSearchResults(searchResults);
  cron.schedule(cronExpression, async () => {
    const emailBody = formatEmailBody(updates);

    // Send an email with the retrieved updates
    await sendEmail(emailFrom, emailTo, `Latest Updates on '${topic}'`, emailBody);
  });

  res.json({
    success: true,
    message: `Updates will be sent according to your chosen schedule: ${scheduleOption}`,
  });
  
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});

