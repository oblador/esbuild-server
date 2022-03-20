import { fetchComic } from './api';

async function main() {
  try {
    const comic = await fetchComic();
    const img = document.createElement('img');
    img.src = comic.img;
    img.alt = comic.alt;
    document.body.appendChild(img);
  } catch (err) {
    console.error('Something went wrong fetching the comic');
  }
}

main();
