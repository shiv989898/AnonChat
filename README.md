# AnonChat: The "Human or AI?" Game

This is a web-based chat game where you have 60 seconds to guess whether you're talking to another human player or a sophisticated AI. This project showcases real-time communication, AI integration, and modern web development practices.

## Key Features

- **Real-time Anonymous Chat:** Engage in fast-paced conversations with a stranger.
- **Human vs. Human & Human vs. AI:** Get matched with another player from the waiting pool. If no one is available, you'll test your wits against an AI designed to mimic human conversation.
- **60-Second Timer:** Think fast! You only have one minute to make your guess.
- **Genkit-Powered AI:** The AI opponent is powered by Google's Genkit, making its responses convincingly human-like.
- **Firebase Backend:** Leverages Firebase for anonymous authentication and Firestore for real-time matchmaking and chat functionality.
- **Modern UI:** Built with ShadCN UI components and styled with Tailwind CSS for a clean and responsive user experience.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS & ShadCN UI
- **AI Integration:** Google Genkit
- **Backend & Database:** Firebase (Authentication, Firestore)
- **Deployment:** Firebase App Hosting

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18 or later)
- npm or another package manager

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Firebase Setup

This project is configured to work with Firebase.

1.  The necessary Firebase configuration is already included in `src/firebase/config.ts`.
2.  The application uses Firebase Authentication (Anonymous) and Firestore. Make sure these are enabled in your Firebase project console.
3.  The Firestore security rules are located in `firestore.rules`. These are set up to allow reads and writes for authenticated users in their respective chat sessions.

### Running the Application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

2.  **Start the Genkit development server (for AI flows):**
    In a separate terminal, run:
    ```bash
    npm run genkit:watch
    ```
    This will start the Genkit server and watch for changes in your AI flow files.

Now you can open your browser and start playing the "Human or AI?" game!
