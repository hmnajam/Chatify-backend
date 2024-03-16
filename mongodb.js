require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoURL = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}`;
// console.log('MOngo Url is ', mongoURL);

// Defining mongoClient for mongodb connection
const mongoClient = new MongoClient(mongoURL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

// Mongodb collection configuraion.
const authInfoCollection = mongoClient.db(process.env.Database).collection(process.env.auth_info);
const sentMessagesCollection = mongoClient.db(process.env.Database).collection(process.env.Collection);

module.exports = { mongoClient, authInfoCollection, sentMessagesCollection };
