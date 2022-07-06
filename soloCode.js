const WebSocket = require("ws");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
require('dotenv').config();
const wss = new WebSocket.Server({ server });
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = require('twilio')(accountSid, authToken);

const urlencoded = require('body-parser').urlencoded;

// Parse incoming POST params with Express middleware
app.use(urlencoded({ extended: false }));

//Include Google Speech to Text
const speech = require("@google-cloud/speech");
const client = new speech.SpeechClient();

//Configure Transcription Request
const request = {
  config: {
    encoding: "MULAW",
    sampleRateHertz: 8000,
    languageCode: "en-GB",
    useEnhanced: true,
    model: 'phone_call',
  },
  interimResults: true
};

let phoneNumber = '';
// Handle Web Socket Connection
wss.on("connection", function connection(ws) {
console.log("New Connection Initiated");

 let recognizeStream = null;
 let sentence = "";

  ws.on("message", function incoming(message) {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case "connected":
        console.log(`A new call has connected.`);

        // Create Stream to the Google Speech to Text API
        recognizeStream = client
          .streamingRecognize(request)
          .on("error", console.error)
          .on("data", data => {
            console.log(data.results[0]);
            if(data.results[0].isFinal){
                sentence += data.results[0].alternatives[0].transcript
            }
          });
        break;
      case "start":
        console.log(`Starting Media Stream ${msg.streamSid}`);
        break;
      case "media":
        // Write Media Packets to the recognize stream
        recognizeStream.write(msg.media.payload);
        break;
      case "stop":
        console.log(`Call Has Ended`);
        console.log(sentence)
        
        twilioClient.messages.create({
     body: sentence,
     from: '', // This needs to be twilio number
     to: phoneNumber
   })
  .then(message => console.log(message.sid));
        recognizeStream.destroy();
        sentence = '';
        break;
    }
  });
});

//Handle HTTP Request
app.get("/", (req, res) => res.send("Hello World"));

app.post("/", (req, res) => {
    phoneNumber = req.body.From
  res.set("Content-Type", "text/xml");

  res.send(`
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/"/>
      </Start>
      <Say>Hey, what's up?</Say>
      <Pause length="60" />
    </Response>
  `);
});

console.log("Listening at Port 8080");
server.listen(8080);