# Acumen

Acumen is a web application designed to help users create marketplace listings and manage them across multiple platforms. It features a visually appealing interface with animations and interactive elements. The application allows users to upload images and generate descriptions and price estimates using OpenAI's API.

## Features

- **Responsive Design**: The layout is responsive and adapts to different screen sizes, ensuring a seamless user experience.
- **Express.js Backend**: Acumen uses Express.js for its backend, handling image uploads and interactions with OpenAI's API.
- **User Authentication**: Includes buttons for user login and signup, facilitating user management.

## Technologies Used

- **HTML/CSS/JavaScript**: For the frontend interface and animations.
- **Express.js**: For the backend and handling user interactions.
- **React**: For building the interactive frontend.
- **Multer**: For handling file uploads.
- **OpenAI API**: To generate descriptions and price estimates for uploaded images.

## Getting Started

### Prerequisites

- Node.js and npm installed on your machine.
- An OpenAI API key.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ggiordann/acumen/tree/main/acumen
   cd acumen
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your OpenAI API key:
   ```
   OPENAI_KEY=your_openai_api_key
   ```

4. Start the server:
   ```bash
   node acumen/server.js
   ```

5. Open a new terminal and start the React app:
   ```bash
   cd acumen
   npm start
   ```

6. Open your web browser and go to `http://localhost:3000` to access the application.

## Contributing

1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature-name
   ```
3. Make your changes and commit them with a descriptive message:
   ```bash
   git commit -m "Add feature: description of feature"
   ```
4. Push your changes to your fork:
   ```bash
   git push origin feature-name
   ```
5. Open a pull request on the main repository.

## License

This project is licensed under the MIT License.
