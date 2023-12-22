[![](https://i.imgur.com/2OiHVyRs.jpg)](http://localhost:3001)

Event Tracker
====
Keep track of all the updates to any event you want to track from around the world.

Usage
====
Event Tracker will accept the name of any event you want to track, prompt you for the frequency of updates you want to get and then simply just give you what you want.

Features
====
* Extremely easy to use. Get all the updates you want with just a few clicks and without any special configuration.
* Supports a wide range of events from all over the world.
* Ability to generate a brief summary of the event when the user doesn't want all the updates.
* Ability to automatically provide the updates on your email.
* Ability to automatically provide the updates on other platforms.(Pending)
* Ability to provide additional information about the event.(Pending)

Local Setup
====
1. Install [Docker](https://www.docker.com/get-started) on your machine.
2. Clone the repository:

```bash
git clone git@github.com:aniketh3014/event-tracker.git
```
3. Change the working directory
```bash
cd event-tracker
```
4. Build the Docker image:
```bash
docker build -t event-tracker .
```
5. Run the Docker container:
```bash
docker run -d -p 3000:3000 -v $(pwd):/app event-tracker
```
The application should now be running at <http://localhost:3000>