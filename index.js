// import the necessary modules
import express from 'express';
import bodyParser from 'body-parser';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import axios from 'axios';
import 'dotenv/config'

const app = express();
const port = 3000;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// use the google search api key
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_API;

// define the email from which the updates will be delivered
const emailFrom = process.env.MY_EMAIL;

const userSubscriptions = {};

// define the schedule options
const cronExpressions = {
  hour: '0 * * * *',
  day: '0 9 * * *',
  week: '0 9 * * 1',
  minute: '* * * * *',
};

// provide the credentials for the node mailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MY_EMAIL, 
    pass: process.env.MY_PASSWORD,
  }
});

// define the email function
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

// get the search results from the google custom search api
async function getSearchResults(topic) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=a60c4c10e04c546d5&q=${topic}`;
  const response = await axios.get(url);
  const searchResults = response.data.items;
  return searchResults;
}

// process the search results
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

// format the email body
function formatEmailBody(updates) {
  let emailBody = '';
  for (const update of updates) {
    emailBody += `
        <div style="margin-bottom: 20px; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background-color: #f5f5f5;">
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

// define the default route
app.get("/", (req, res) => {
  res.render("index.ejs");
});

// define the subscribe route
app.post('/subscribe', async (req, res) => {
  const topic = req.body.topic;
  const scheduleOption = req.body.scheduleOption;
  const email = req.body.email;

// check if the schedule option is valid
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

  // create a cron job for the user
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

  // send confirmation mail
  const confirmationMessage =`All set! You'll now get updates on ${topic} every ${scheduleOption}.`
  await sendEmail(emailFrom, email, 'Subscription Confirmation', confirmationMessage);

  const subscribedTopics = userSubscriptions[email].topics;
  res.render("index.ejs", { message: subscribedTopics });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});