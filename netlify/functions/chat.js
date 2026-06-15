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
    body.messages.forEach(m => messages.push(m));

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
    console.log("Groq response:", JSON.stringify(data));
    const text = data.choices?.[0]?.message?.content;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: [{ text: text || "No response received" }]
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
