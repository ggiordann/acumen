document.getElementById('fileUploader').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            document.getElementById('imagePreview').innerHTML = '';
            document.getElementById('imagePreview').appendChild(img);
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('analyzeButton').addEventListener('click', async function() {
    const responseDiv = document.getElementById('response');
    responseDiv.innerHTML = 'Analyzing...';

    const fileInput = document.getElementById('fileUploader');
    const file = fileInput.files[0];

    if (!file) {
        responseDiv.innerHTML = 'Please upload an image.';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result.split(',')[1]; // Get base64 part

        const prompt = "Based on the uploaded image, create an estimated price and generate a description.";
        const payload = {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500
        };

        try {
            const response = await fetch('YOUR_API_ENDPOINT', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer YOUR_API_KEY`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            responseDiv.innerHTML = data.choices[0].message.content;
        } catch (error) {
            responseDiv.innerHTML = `An error occurred: ${error.message}`;
        }
    };

    reader.readAsDataURL(file);
});
