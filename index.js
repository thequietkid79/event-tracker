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
const PALM_API_KEY = process.env.PLAM_API;

const emailFrom = 'my';
let emailTo;

const userSubscriptions = {}; // Keep track of user subscriptions

const cronExpressions = {
  hourly: '0 * * * *',
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MY_EMAIL, // Replace with your Gmail email address
    pass: process.env.MY_PASSWORD, // Replace with your Gmail password or an application-specific password
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

async function getSearchResults(topic) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=a60c4c10e04c546d5&q=${topic}`;
  const response = await axios.get(url);
  const searchResults = response.data.items;
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

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post('/subscribe', async (req, res) => {
  // const { topic, scheduleOption, email } = req.body;
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

  // If there's an existing cron job, cancel it
  if (userSubscriptions[email].cronJob) {
    userSubscriptions[email].cronJob.destroy();
  }
}

// Fetch updates for all subscribed topics
const allUpdates = [];
for (const subscribedTopic of userSubscriptions[email].topics) {
  const searchResults = await getSearchResults(subscribedTopic);
  const updates = await processSearchResults(searchResults);
  console.log(updates);
  allUpdates.push(...updates);
}

    // Create a new cron job with the updated list of topics
  userSubscriptions[email].cronJob = cron.schedule(cronExpression, async () => {
    

    const emailBody = formatEmailBody(allUpdates);

    await sendEmail(emailFrom, email, `Latest Updates`, emailBody);
  });

    res.render("index.ejs", { message: `Subscribed to topic: ${topic}`});
});

app.post('/unsubscribe', (req, res) => {
  const { topic, email } = req.body;

  if (userSubscriptions[email]) {
    // Remove the specified topic from the user's subscriptions
    userSubscriptions[email].topics = userSubscriptions[email].topics.filter(t => t !== topic);

    // If there are no more topics, cancel the cron job
    if (userSubscriptions[email].topics.length === 0 && userSubscriptions[email].cronJob) {
      userSubscriptions[email].cronJob.destroy();
    }

    res.render("index.ejs", { message: `Unsubscribed from topic: ${topic}` });
  } else {
    res.json({
      success: false,
      message: `User not found or not subscribed to any topics`,
    });
  }
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});