exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "",
    };
  }
  try {
    const body = JSON.parse(event.body);
    const messages = [];
    if (body.system) {
      messages.push({ role: "system", content: body.system });
    }
    body.messages.forEach(m => messages.push({ role: m.role, content: m.content }));

    // Try with retries
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      const data = await res.json();

      if (res.status === 429) {
        lastError = "Rate limit hit, retrying...";
        continue;
      }

      if (!res.ok) {
        lastError = data.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        lastError = "Empty response from AI";
        continue;
      }

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: [{ text }] })
      };
    }

    // All retries failed
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: [{ text: `The AI is busy right now. Please wait a few seconds and try again. (${lastError})` }]
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        content: [{ text: "Error: " + err.message }]
      })
    };
  }
};
