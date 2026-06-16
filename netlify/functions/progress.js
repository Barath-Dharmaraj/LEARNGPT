exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const BIN_ID  = process.env.JSONBIN_ID;
  const API_KEY = process.env.JSONBIN_KEY;

  try {
    const { action, email, data } = JSON.parse(event.body);

    // Get current bin data
    const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    const d = await r.json();
    const record = d.record || {};
    const progress = record.progress || {};

    if (action === "save") {
      // Student saves their progress
      progress[email] = {
        ...progress[email],
        ...data,
        lastActive: Date.now()
      };
      record.progress = progress;
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

    if (action === "getAll") {
      // Admin gets all students progress
      return { statusCode: 200, headers, body: JSON.stringify({ progress }) };
    }

    if (action === "get") {
      // Student gets own progress
      return { statusCode: 200, headers, body: JSON.stringify({ progress: progress[email] || {} }) };
    }

  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
