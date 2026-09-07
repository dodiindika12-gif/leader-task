const url = 'https://db.absgroup.biz.id/auth/v1/signup';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MjMxMjM2LCJleHAiOjE5NDU5MTEyMzZ9.nNHFrq9e9IJ6kLXEea5lfzOUa8a0506kFg3nyNZEyHU';

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': 'Bearer ' + key
  },
  body: JSON.stringify({
    email: 'abskdi.markom@gmail.com',
    password: 'ABSgroup#123'
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
