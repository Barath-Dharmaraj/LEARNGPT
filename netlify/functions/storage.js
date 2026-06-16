const fs = require("fs");
const path = require("path");

// Use /tmp for serverless storage (persists during function warm state)
// For true persistence use a free DB like PlanetScale or Supabase
const STORE = {};

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const { action, key, value } = JSON.parse(event.body);
    const BIN_ID = process.env.JSONBIN_ID;
    const API_KEY = process.env.JSONBIN_KEY;

    if (action === "get") {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { "X-Master-Key": API_KEY }
      });
      const d = await r.json();
      const record = d.record || {};
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ value: record[key] || null })
      };
    }

    if (action === "set") {
      // Get current data first
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { "X-Master-Key": API_KEY }
      });
      const d = await r.json();
      const record = d.record || {};
      record[key] = value;

      // Update bin
      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY
        },
        body: JSON.stringify(record)
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
