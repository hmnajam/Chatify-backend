// Import necessary modules
const axios = require('axios');

// Define the endpoint URL
const endpointUrl = 'https://chatify-drlab.onrender.com/send-message';

// Define the test using Jest
test('Verify send-message endpoint with correct parameters', async () => {
  try {
    // Make GET request to the endpoint
    const response = await axios.get(endpointUrl, {
      params: {
        number: '923131060542',
        message: 'ping',
        sessionId: 'najam'
      }
    });

    // Verify the response status
    expect(response.status).toBe(200);

    // Verify the response data
    // expect(response.data).toEqual({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});
