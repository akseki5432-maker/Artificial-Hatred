# Putting the website online (free)

The site is plain HTML with no build step, so any free static host works. There are three good options, from easiest to most work.

## Option A: Cloudflare Pages (recommended, gives a clean free name)

Your address: **`https://main-street-ledger.pages.dev`** (or a similar name, if that one is taken)

1. Make a free account at <https://dash.cloudflare.com/sign-up>.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**, and pick this GitHub repository.
3. Settings:
   - **Project name:** `main-street-ledger`. This becomes the `*.pages.dev` address.
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. Click **Save and Deploy**. Every later push to `main` updates the site automatically.

Netlify (`your-name.netlify.app`) works the same way if you prefer it.

## Option B: GitHub Pages (already set up in this repo)

Your address: **`https://<your-username>.github.io/<repo-name>/`**

1. **Rename the repo first.** The repo name appears in the address. Go to **Settings → General → Repository name** and use something like `main-street-ledger`.
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Merge this branch into `main`. The workflow in `.github/workflows/pages.yml` runs the tests and publishes the site. The address appears in **Settings → Pages**.

## Option C: Your own domain name (e.g. `mainstreetledger.me`)

Truly free custom domains are rare, and most "free domain" sites are unreliable or can take the name back. Two honest routes:

- **GitHub Student Developer Pack** (<https://education.github.com/pack>). Verified students get free offers that have included a free domain name for one year, such as a `.me` domain from Namecheap or a `.tech` domain. Check the pack for what's offered now, and note that the domain costs money to renew after the free year.
- **Buy one.** A `.com` or `.org` is usually around $10–15 a year. Some students ask a teacher or their school for it if the project is an official club.

To connect a domain:
- **Cloudflare Pages:** In your project, go to **Custom domains → Set up a custom domain**, and follow the DNS steps it shows.
- **GitHub Pages:** In **Settings → Pages → Custom domain**, enter the domain. Then at your domain registrar, add:
  - `A` records for the root domain pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
  - a `CNAME` record for `www` pointing to `<your-username>.github.io`

  Then tick **Enforce HTTPS** once it becomes available. DNS changes can take up to a day.

## Before you share the link

Open `src/site.js` and fill in:

- **`request`:** a link to a request form. A free Google Form is a good choice: ask for business name, type, neighborhood, best days/times, and how to reach them. Until this is set, the homepage says "Checkup requests open soon."
- **`email`** (optional): a public contact address. Use a separate project email, not your personal one.
- **`playbook`** (optional): a link to `docs/PLAYBOOK.md` on GitHub, for other students.

Then commit and push. The live site updates within a minute or two.

## Honesty checklist

The homepage avoids made-up claims on purpose: there are no fake testimonials, no "trusted by 50 businesses," and no invented results. Keep it that way. When you have real results, you could add a short "Results so far" section using numbers from the findings dashboard, with owners' permission and without names.
