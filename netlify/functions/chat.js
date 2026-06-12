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

    // Build prompt from messages
    let prompt = "";
    if (body.system) {
      prompt += `System: ${body.system}\n\n`;
    }
    body.messages.forEach(m => {
      if (m.role === "user") prompt += `User: ${m.content}\n`;
      if (m.role === "assistant") prompt += `Assistant: ${m.content}\n`;
    });
    prompt += "Assistant:";

    const res = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_API_KEY}`
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            return_full_text: false
          }
        })
      }
    );

    const data = await res.json();
    console.log("HF response:", JSON.stringify(data));

    let text = "";
    if (Array.isArray(data)) {
      text = data[0]?.generated_text || "";
    } else if (data.error) {
      text = "Model is loading, please try again in 20 seconds: " + data.error;
    } else {
      text = JSON.stringify(data);
    }

    // Clean up response
    text = text.split("User:")[0].trim();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: [{ text: text || "No response" }]
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
