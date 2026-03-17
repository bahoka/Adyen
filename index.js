import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

app.post("/adyen/webhook", async (req, res) => {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

    const items = req.body.notificationItems;

    for (const item of items) {
        const data = item.NotificationRequestItem;

        if (data.eventCode === "NOTIFICATION_OF_FRAUD") {
            await sendToSlack(data);
        }
    }

    res.send("[accepted]");
});

async function sendToSlack(data) {
    const message = {
        text: "🚨 Notification of Fraud",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*🚨 Fraud Alert (Adyen)*"
                }
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*Order:*\n${data.merchantReference}` },
                    { type: "mrkdwn", text: `*PSP:*\n${data.pspReference}` }
                ]
            }
        ]
    };

    await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));