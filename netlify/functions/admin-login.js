exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const { email, password } = JSON.parse(event.body);
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPass  = process.env.ADMIN_PASS;

    if (
      email.toLowerCase() === adminEmail.toLowerCase() &&
      password === adminPass
    ) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: true })
      };
    }
    return {
      statusCode: 401,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: "Invalid credentials" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
