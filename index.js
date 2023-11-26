import express from 'express';
import bodyParser from 'body-parser';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import axios from 'axios';
import 'dotenv/config'

const app = express();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_API;

const emailFrom = process.env.MY_EMAIL;

const userSubscriptions = {}; // Keep track of user subscriptions

const cronExpressions = {
  hourly: '0 * * * *',
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
  everyMinute: '* * * * *', // Option for every minute
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MY_EMAIL, 
    pass: process.env.MY_PASSWORD,
  }
});

async function sendEmail(from, to, subject, html) {
  const mailOptions = {
    from,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully.');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function getSearchResults(topic) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=a60c4c10e04c546d5&q=${topic}`;
  const response = await axios.get(url);
  const searchResults = response.data.items;
  return searchResults;
}

async function processSearchResults(searchResults) {
  const updates = [];

  for (const searchResult of searchResults) {
    const { title, link, snippet } = searchResult;

    const update = {
      title,
      url: link,
      snippet,
    };

    updates.push(update);
  }

  return updates;
}

function formatEmailBody(updates) {
  let emailBody = '';

  for (const update of updates) {
    emailBody += `
        <div style="margin-bottom: 20px; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 10px;">${update.title}</h2>
            <p style="color: #555; font-size: 14px; margin-bottom: 10px;">
                <strong>URL:</strong> <a href="${update.url}" style="color: #007bff; text-decoration: none;">${update.url}</a>
            </p>
            <p style="color: #666; font-size: 16px; margin-bottom: 20px;">${update.snippet}</p>
        </div><br/>
    `;
  }

  return emailBody;
}

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post('/subscribe', async (req, res) => {
  const topic = req.body.topic;
  const scheduleOption = req.body.scheduleOption;
  const email = req.body.email;

  if (!cronExpressions.hasOwnProperty(scheduleOption)) {
    res.json({
      success: false,
      message: `Invalid schedule option: ${scheduleOption}`,
    });
    return;
  }

  const cronExpression = cronExpressions[scheduleOption];

  if (!userSubscriptions[email]) {
    userSubscriptions[email] = {
      topics: [],
      cronJob: null,
    };
  }

  if (!userSubscriptions[email].topics.includes(topic)) {
    userSubscriptions[email].topics.push(topic);

    const cronJob = cron.schedule(cronExpression, async () => {
      const searchResults = await getSearchResults(topic);
      const updates = await processSearchResults(searchResults);
      const emailBody = formatEmailBody(updates);
      await sendEmail(emailFrom, email, 'Search Results', emailBody);
    });

    userSubscriptions[email].cronJob = cronJob;
  }

  // Send confirmation email
  const confirmationMessage =`Subscription confirmed for ${topic} updates. You will receive updates ${scheduleOption}.`
  await sendEmail(emailFrom, email, 'Subscription Confirmation', confirmationMessage);

  const subscribedTopics = userSubscriptions[email].topics;
  res.render("index.ejs", { message: subscribedTopics });
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});