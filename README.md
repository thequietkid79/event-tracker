![Event Tracker](https://i.imgur.com/2OiHVyRs.jpg)

# Event Tracker

Track updates for any event worldwide effortlessly.

## Usage

Event Tracker allows you to monitor updates for any event of your choice. Simply input the event's name, set the desired update frequency, and let Event Tracker deliver the information you need.

## Features

- **User-Friendly**: Easily obtain updates with just a few clicks and without complicated configurations.
- **Global Event Coverage**: Supports a diverse range of events from around the world.
- **Event Summaries**: Generate concise summaries for events when you prefer a quick overview.
- **Email Notifications**: Automatically receive updates via email.
- **Cross-Platform Integration** (Pending): Soon, get updates seamlessly on various platforms.
- **Additional Event Information** (Pending): Explore more details about the event.

## Local Setup

1. **Install Docker**: Make sure to have [Docker](https://www.docker.com/get-started) installed on your machine.
2. **Clone the Repository**:

    ```bash
    git clone git@github.com:aniketh3014/event-tracker.git
    ```

3. **Change Directory**:

    ```bash
    cd event-tracker
    ```

4. **Build Docker Image**:

    ```bash
    docker build -t event-tracker .
    ```

5. **Run Docker Container**:

    ```bash
    docker run -d -p 3000:3000 -v $(pwd):/app event-tracker
    ```

The application will now be accessible at [http://localhost:3000](http://localhost:3000).
