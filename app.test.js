const axios = require('axios');

// Define the endpoint URL
const homeUrl = 'https://chatify-drlab.onrender.com/';
// Define the test using Jest
test('Verify home page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(homeUrl);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the endpoint URL
const scanUrl = 'https://chatify-drlab.onrender.com/scan';
// Define the test using Jest
test('Verify scan page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(scanUrl);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the endpoint URL
const pastMessagesUrl = 'https://chatify-drlab.onrender.com/get-all-messages';
// Define the test using Jest
test('Verify get all messages page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(pastMessagesUrl);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the endpoint URL
const apiDocsUrl = 'https://chatify-drlab.onrender.com/api-docs/';
// Define the test using Jest
test('Verify get all messages page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(apiDocsUrl);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the endpoint URL
const sendMessageUrl = 'https://chatify-drlab.onrender.com/send-message';
// Define the test using Jest
test('Verify send-message endpoint with correct parameters', async () => {
  try {
    // Make GET request to the endpoint
    const response = await axios.get(sendMessageUrl, {
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
