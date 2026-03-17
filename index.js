import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// простая дедупликация (в памяти)
const processedEvents = new Set();

app.post("/adyen/webhook", async (req, res) => {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

    try {
        const items = req.body.notificationItems || [];

        for (const item of items) {
            const data = item.NotificationRequestItem;

            const key = `${data.pspReference}-${data.eventCode}`;

            // защита от дублей
            if (processedEvents.has(key)) {
                console.log("Duplicate event skipped:", key);
                continue;
            }

            processedEvents.add(key);

            if (data.eventCode === "NOTIFICATION_OF_FRAUD") {
                await sendToSlack(data);
            }
        }

        res.status(200).send("[accepted]");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(200).send("[accepted]"); // важно для Adyen
    }
});

async function sendToSlack(data) {
    const adyenUrl = `https://ca-live.adyen.com/ca/ca/accounts/overview.shtml?pspReference=${data.pspReference}`;

    const message = {
        text: "🚨 Fraud Alert",
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*🚨 Fraud Alert (Adyen Notification of Fraud)*"
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Order:*\n${data.merchantReference || "N/A"}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*PSP Reference:*\n${data.pspReference}`
                    }
                ]
            },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Open in Adyen"
                        },
                        url: adyenUrl
                    }
                ]
            }
        ]
    };

    await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(message)
    });

    console.log("Sent to Slack:", data.pspReference);
}

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});