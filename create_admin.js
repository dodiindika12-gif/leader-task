const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.absgroup.biz.id';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MjMxMjM2LCJleHAiOjE5NDU5MTEyMzZ9.nNHFrq9e9IJ6kLXEea5lfzOUa8a0506kFg3nyNZEyHU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    console.log('Attempting to create super user...');
    const { data, error } = await supabase.auth.signUp({
        email: 'abskdi.markom@gmail.com',
        password: 'ABSgroup#123',
    });
    
    if (error) {
        console.error('Error creating admin:', error.message);
    } else {
        console.log('Admin user created or already exists:', data.user?.email);
    }
}
createAdmin();
