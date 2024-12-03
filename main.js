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
                    content: prompt
                },
                {
                    role: "user",
                    content: {
                        type: "image",
                        image: {
                            base64: base64Image
                        }
                    }
                }
            ],
            max_tokens: 500
        };

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer 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`
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
