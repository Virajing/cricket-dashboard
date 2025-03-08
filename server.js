const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Mock data
const mockMatches = {
    "status": "success",
    "data": [
        {
            "id": "nz-ind-2024",
            "name": "New Zealand vs India",
            "matchType": "t20",
            "status": "Live",
            "venue": "Eden Park, Auckland",
            "date": "2024-02-25",
            "dateTimeGMT": "2024-02-25T06:30:00",
            "teamInfo": [
                {
                    "name": "New Zealand",
                    "shortname": "NZ",
                    "img": "https://cricapi.com/images/nz.png"
                },
                {
                    "name": "India",
                    "shortname": "IND",
                    "img": "https://cricapi.com/images/ind.png"
                }
            ]
        },
        {
            "id": "aus-eng-2024",
            "name": "Australia vs England",
            "matchType": "test",
            "status": "Live",
            "venue": "MCG, Melbourne",
            "date": "2024-02-25",
            "dateTimeGMT": "2024-02-25T00:00:00",
            "teamInfo": [
                {
                    "name": "Australia",
                    "shortname": "AUS",
                    "img": "https://cricapi.com/images/aus.png"
                },
                {
                    "name": "England",
                    "shortname": "ENG",
                    "img": "https://cricapi.com/images/eng.png"
                }
            ]
        }
    ]
};

const mockMatchScore = {
    "status": "success",
    "data": {
        "id": "nz-ind-2024",
        "name": "New Zealand vs India",
        "matchType": "t20",
        "status": "India needs 50 runs in 30 balls",
        "venue": "Eden Park, Auckland",
        "date": "2024-02-25",
        "dateTimeGMT": "2024-02-25T06:30:00",
        "score": {
            "team1Score": "185/4",
            "team1Overs": "20.0",
            "team2Score": "136/3",
            "team2Overs": "15.0"
        },
        "teamInfo": [
            {
                "name": "New Zealand",
                "shortname": "NZ",
                "img": "https://cricapi.com/images/nz.png"
            },
            {
                "name": "India",
                "shortname": "IND",
                "img": "https://cricapi.com/images/ind.png"
            }
        ],
        "batting": {
            "partnership": {
                "batsman1": {
                    "name": "Virat Kohli",
                    "runs": "75",
                    "balls": "45",
                    "fours": "8",
                    "sixes": "3"
                },
                "batsman2": {
                    "name": "KL Rahul",
                    "runs": "42",
                    "balls": "28",
                    "fours": "4",
                    "sixes": "2"
                }
            }
        },
        "recentOvers": [
            {
                "over": "14.1",
                "balls": ["1", "4", "6", "2", "0", "1"]
            },
            {
                "over": "14.2",
                "balls": ["4", "1", "W", "0", "1", "4"]
            }
        ],
        "winPrediction": {
            "team1": "45",
            "team2": "55"
        }
    }
};

// Routes
app.get('/currentMatches', (req, res) => {
    const apikey = req.query.apikey;
    if (!apikey) {
        return res.status(401).json({ status: "error", message: "API key required" });
    }
    res.json(mockMatches);
});

app.get('/match_info', (req, res) => {
    const apikey = req.query.apikey;
    const id = req.query.id;
    if (!apikey) {
        return res.status(401).json({ status: "error", message: "API key required" });
    }
    if (!id) {
        return res.status(400).json({ status: "error", message: "Match ID required" });
    }
    res.json(mockMatchScore);
});

app.get('/match_score', (req, res) => {
    const apikey = req.query.apikey;
    const id = req.query.id;
    if (!apikey) {
        return res.status(401).json({ status: "error", message: "API key required" });
    }
    if (!id) {
        return res.status(400).json({ status: "error", message: "Match ID required" });
    }
    res.json(mockMatchScore);
});

// Start server
app.listen(port, () => {
    console.log(`Mock Cricket API server running at http://localhost:${port}`);
}); 