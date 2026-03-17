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
    const amount = data.amount
        ? `${data.amount.value / 100} ${data.amount.currency}`
        : "N/A";

    const fraudReason = data.additionalData?.fraudReason || "N/A";

    const merchantAccount = data.merchantAccountCode || "N/A";

    const cardSummary = data.additionalData?.cardSummary || "****";
    const cardCountry = data.additionalData?.cardCountry || "N/A";

    const message = {
        text: "🚨 Fraud Alert",
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "🚨 Fraud Alert (Adyen)"
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Merchant:*\n${merchantAccount}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Order ID:*\n${data.merchantReference || "N/A"}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*PSP Reference:*\n${data.pspReference}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Amount:*\n${amount}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Card:*\n**** ${cardSummary}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Card Country:*\n${cardCountry}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Fraud Reason:*\n${fraudReason}`
                    }
                ]
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: "⚠️ Recommended action: Review and consider refund to prevent potential chargeback"
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