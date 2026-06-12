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
    const contents = [];
    if (body.system) {
      contents.push({ role:"user", parts:[{ text:"Instructions: "+body.system }] });
      contents.push({ role:"model", parts:[{ text:"Understood." }] });
    }
    body.messages.forEach(m => {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      }
    );
    const data = await res.json();
    console.log("Gemini response:", JSON.stringify(data));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ content: [{ text: "Error: " + JSON.stringify(data) }] })
    };
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ content: [{ text }] })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text: "Error: " + err.message }] })
    };
  }
};
