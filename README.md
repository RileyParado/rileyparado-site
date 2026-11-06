# rileyparado.org

## Add a project
1. Go to app.pagescms.org, sign in with GitHub, and open this repository.
2. Open "Portfolio entries" and add an entry: title, year, description, photos, documents.
3. Save. The site updates a minute or two later.

Every entry gets its own page (project.html), linked from its card and listed in the sidebar. On the card, the summary shows if you wrote one; otherwise the start of the description. In the description, a blank line starts a new paragraph, a line starting with "- " becomes a bullet, and **text** is bold. Entries show newest year first; within a year they follow the order of the list in the editor, which you can reorder.

## One-time setup
1. Create a public GitHub repository and upload everything in this folder.
2. In the repository, open Settings > Pages and deploy from the main branch, root folder.
3. Under Custom domain, enter rileyparado.org. GitHub shows the DNS records to add at your domain registrar.
4. Keep the Google Sites page live until the new site works, then switch the domain over.

## Edit the rest of the site
- Name, intro, About and Contact text: index.html
- Colors and fonts: the top of style.css
- Hero banner photo: add your photo as images/hero.jpg (a dark overlay is applied for you)
- Portrait: images/portrait.jpg. It and the first two project photos were cropped from screenshots, so replace them with the originals
- Preview on your computer: run `python3 -m http.server` in this folder and open http://localhost:8000
