# Main Street Ledger Playbook

How to turn this tool into a real program: free 30-minute financial checkups for small local businesses.

The software is the easy part. The part that matters, for the businesses and for your application, is that you **sat down with real owners and helped them see something they couldn't see before.**

---

## Phase 0: Get ready (week 1)

1. **Deploy the site** (see the README). You want a link you can text to an owner.
2. **Practice on 2 businesses you already know**, such as a family member's business, a friend's parent's shop, or a place where you work. Ask them to be honest about what was confusing.
3. **Learn the four ideas cold** so you can explain each one in a single sentence:
   - **Margin per sale:** what's left from each sale after the cost of making it.
   - **Break-even:** how many sales it takes to cover rent and the other fixed bills.
   - **Price change trade-off:** a 10% price increase can usually survive losing more than 10% of customers.
   - **Cash forecast:** profit is not cash. A profitable shop can still bounce a check in week 9.
4. **Optional, but it helps a lot:** ask a business or economics teacher to be your faculty advisor. They can review your first few reports and give you credibility when you approach owners.

## Phase 1: Find businesses (weeks 2–4)

Good fits are owner-operated businesses with 0–10 employees, like cafés, food trucks, salons, barbershops, bakeries, repair shops, tutoring businesses, and corner stores.

Ways in, from easiest to hardest:
- People you know, and the people they know.
- Your local **Chamber of Commerce** or **Small Business Development Center (SBDC)**. Email them and ask whether they'd share the offer with members.
- Walk-ins during slow hours (2–4 pm on a weekday). Bring a printed sample report.
- Business-improvement district or "Main Street" program offices.

**Short pitch (in person or by email):**

> Hi, I'm ___, a student at ___. I run a free program that gives small businesses a 30-minute financial checkup: your break-even point, what a price change would do, and a 13-week cash forecast. You keep the one-page report. Nothing is uploaded; it all stays on my laptop. Could I have 30 minutes sometime in the next two weeks?

## Phase 2: Run the checkup (30 minutes)

| Time | What you do |
|---|---|
| 0–5 min | Explain what you'll cover and that the numbers stay private. Ask: *"What keeps you up at night about the business?"* |
| 5–12 min | Fill in the profile together. Rough numbers are fine. |
| 12–18 min | Enter their top 5–10 products in **Product lineup**. Owners are often surprised here, because a best-seller can turn out to be a "Workhorse" or even lose money. |
| 18–25 min | Walk through the health check and the price table. Add their big upcoming expenses to the cash forecast. |
| 25–30 min | Agree on **one** next step and write it in Notes. Click **Save today as first-visit baseline**, then **Download data** (with permission). Print or save the report. Schedule a 5-minute follow-up in 30 days. |

Rules:
- **Don't give tax, legal, or investment advice.** If they ask, point them to the SBDC (it's free) or an accountant.
- **Don't keep their numbers without permission.** Use "Download data" only if they say yes, and store the file safely.
- **Listen more than you talk.** The owner knows the business; you bring the math.

## Phase 3: Follow up and measure impact (30 days later)

If you can, do the follow-up in person. Open the business's saved file (**Open saved data**), update the visit date and any numbers that changed (prices, costs, sales, cash), and the **Progress since first visit** section appears automatically. Download the updated file afterward. That before-and-after record is your proof of impact, so don't edit the baseline to make results look better.

If you can only send a text or make a quick call:
1. Did you take the next step we agreed on? (yes / partly / no)
2. Was anything in the report new to you? (1–5)
3. Would you recommend this to another owner? (yes / no), and if yes, who?

Log the answers in [`impact-log.csv`](impact-log.csv). **Track only what you actually observed**, and never invent or round up numbers. Admissions readers can tell, and honest small numbers are more convincing anyway.

Ask happy owners for a referral. That's how you grow from 5 businesses to 20.

## Phase 4: Grow it (optional, months 2–6)

Pick one or two:
- **Recruit 2–3 classmates** and train them with this playbook. Now you're leading a team, and it can become a school club.
- **Run a free workshop** at the library or Chamber: "Know Your Numbers in 45 Minutes."
- **Partner with the SBDC** so they refer owners who aren't ready for a full advising session.
- **Add a feature owners keep asking for**, such as a Spanish version, a seasonal-sales mode, or a tip-pooling calculator. The code is in `src/`.
- **Write a short findings report.** Open `findings.html`, load every saved checkup file, and click **Copy brief**. It gives you anonymized patterns like "44% had less than one month of cash; 2 of 30 products cost more to make than they sold for." Add your own context and share it with your local paper, the Chamber newsletter, or your school. This turns a set of checkups into original research.

---

## What to put on Common App

Common App gives you **50 characters** for the position, **100** for the organization name, and **150** for the description. Fill in your real numbers. Only claim what you actually did.

**Activity type:** Business / Entrepreneurship (or Community Service, if that's the main angle)

**Position / leadership (≤50):**
`Founder & Lead Consultant` (25)

**Organization (≤100):**
`Main Street Ledger: free financial checkups for local small businesses` (70)

**Description (≤150), pick the one that fits:**

- If you consulted solo:
  `Built a web tool; ran free break-even/pricing/cash-flow checkups for [N] local businesses; [M] made changes, e.g. repricing to fix losing items.`
- If you built a team:
  `Built a finance tool & trained [K] students to run free checkups for [N] small businesses; partnered with [Chamber/SBDC]; [M] owners adopted changes.`
- If you published findings:
  `Built a finance tool; ran checkups for [N] local businesses & published findings on their pricing and cash risks in [paper/newsletter].`
- If you led a workshop:
  `Created a free business-finance tool; consulted [N] local owners 1-on-1 and taught a [X]-person workshop on pricing, break-even & cash flow.`

Check the length before you paste. Common App counts spaces.

**Hours/weeks:** Be accurate. A realistic total is 3–5 hrs/week over 20–30 weeks. That covers prep, checkups, follow-ups, and improving the tool.

**For an essay or interview:** The best material is a specific moment, like the owner who found out their best-selling item was losing money, or the shop that put a big purchase on hold after seeing week 9. Write down stories like these as they happen (with the owner's permission, and without identifying details).
