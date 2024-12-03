document.addEventListener('DOMContentLoaded', function() {
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
            const img = new Image();
            img.src = e.target.result;
            img.onload = async function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxSize = 300; // Reduce the maximum size for the image

                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const resizedBase64Image = canvas.toDataURL('image/jpeg').split(',')[1];

                const payload = {
                    model: "gpt-4",
                    messages: [
                        {
                            role: "system",
                            content: "What do you see?"
                        },
                        {
                            role: "user",
                            content: `Here is an image: data:image/jpeg;base64,${resizedBase64Image}`
                        }
                    ],
                    max_tokens: 100
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
                        const errorText = await response.text();
                        throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
                    }

                    const data = await response.json();
                    responseDiv.innerHTML = data.choices[0].message.content;
                } catch (error) {
                    responseDiv.innerHTML = `An error occurred: ${error.message}`;
                }
            };
        };

        reader.readAsDataURL(file);
    });
});
