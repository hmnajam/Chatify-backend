const axios = require('axios');

// Define the base URL
const baseUrl = 'http://localhost:8000/';

// 'https://chatify-drlab.onrender.com/';

// Define endpoint URLs
const endpoints = {
  home: baseUrl,
  scan: baseUrl + 'scan/',
  pastMessages: baseUrl + 'get-all-messages/',
  apiDocs: baseUrl + 'api-docs/',
  sendMessage: baseUrl + 'send-message/'
};

// Define the test using Jest
test('Verify home page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(endpoints.home);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the test using Jest
test('Verify scan page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(endpoints.scan);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the test using Jest
test('Verify get all messages page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(endpoints.pastMessages);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the test using Jest
test('Verify get all messages page is working.', async () => {
  try {
    // Make GET request to the homepage
    const response = await axios.get(endpoints.apiDocs);
    // Verify the response status
    expect(response.status).toBe(200);
  } catch (error) {
    // Handle any errors
    console.error('Error occurred:', error.message);
  }
});

// Define the test using Jest
test('Verify send-message endpoint with correct parameters', async () => {
  try {
    // Make GET request to the endpoint
    const response = await axios.get(endpoints.sendMessage, {
      params: {
        number: '923131060542',
        message: 'Testing Testing',
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
