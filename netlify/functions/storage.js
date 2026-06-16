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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  try {
    const { action, key, value } = JSON.parse(event.body);

    if (action === "set") {
      STORE[key] = value;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === "get") {
      return { statusCode: 200, headers, body: JSON.stringify({ value: STORE[key] || null }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
