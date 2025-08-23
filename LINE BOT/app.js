const line = require('@line/bot-sdk');
const express = require('express');

const config = {
  channelAccessToken: 'CnT5EpvP2ATp1hWRMB69uDRk9AzmO5+34Pd1QkrcxFe6NTDloT2olr5sNKbX5vJjVUxav5EPSMagBHYt328GPCLK6KE1ZL70JFX2vswFSiTdlCd3VP5GEwQ3xTyKJhfuW3Qt3gT27zPsihcGBCLevQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eaaf339ed4aa0a351b5893f10d4581c5'
};

const client = new line.Client(config);
const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('Error handling events:', err);
      res.status(500).send('Internal Server Error');
    });
});

function handleEvent(event) {
  console.log('Received event:', event);
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: event.message.text
  }).catch(err => {
    console.error('Error replying message:', err);
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});