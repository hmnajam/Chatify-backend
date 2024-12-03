/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use("whatsapp_api");

// Delete one creds
// db.getCollection("auth_info_multi").deleteOne({ _id: "hmnajam-creds" });

// Search for all creds in the current collection.
db.getCollection("auth_info_multi").find({ _id: /-creds$/ });
