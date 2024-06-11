/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-multi-assign */
/* eslint-disable no-undef */
/* eslint-disable no-empty */
const { proto } = require('@whiskeysockets/baileys/WAProto');
const { Curve, signedKeyPair } = require('@whiskeysockets/baileys/lib/Utils/crypto');
const { generateRegistrationId } = require('@whiskeysockets/baileys/lib/Utils/generics');
const { randomBytes } = require('crypto');

const initAuthCreds = () => {
  const identityKey = Curve.generateKeyPair();
  return {
    noiseKey: Curve.generateKeyPair(),
    signedIdentityKey: identityKey,
    signedPreKey: signedKeyPair(identityKey, 1),
    registrationId: generateRegistrationId(),
    advSecretKey: randomBytes(32).toString('base64'),
    processedHistoryMessages: [],
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    accountSettings: {
      unarchiveChats: false
    }
  };
};

const BufferJSON = {
  replacer: (k, value) => {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
      return {
        type: 'Buffer',
        data: Buffer.from(value?.data || value).toString('base64')
      };
    }

    return value;
  },

  reviver: (_, value) => {
    if (typeof value === 'object' && !!value && (value.buffer === true || value.type === 'Buffer')) {
      const val = value.data || value.value;
      return typeof val === 'string' ? Buffer.from(val, 'base64') : Buffer.from(val || []);
    }

    return value;
  }
};

module.exports = useMongoDBAuthState = async (collection, clientId) => {
  const writeData = (data, id) => {
    const informationToStore = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    const update = { $set: { ...informationToStore } };
    return collection.updateOne({ _id: `${clientId}-${id}` }, update, { upsert: true });
  };
  const readData = async (id) => {
    try {
      const data = JSON.stringify(await collection.findOne({ _id: `${clientId}-${id}` }));
      return JSON.parse(data, BufferJSON.reviver);
    } catch (error) {
      return null;
    }
  };
  const removeData = async (id) => {
    try {
      await collection.deleteOne({ _id: `${clientId}-${id}` });
    } catch (_a) {}
  };
  const creds = (await readData('creds')) || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key') {
                value = proto.Message.AppStateSyncKeyData.fromObject(data);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => {
      return writeData(creds, 'creds');
    }
  };
};
