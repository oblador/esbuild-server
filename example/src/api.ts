type APIResponseData = {
  year: string;
  month: string;
  day: string;
  num: number;
  link: string;
  news: string;
  safe_title: string;
  transcript: string;
  alt: string;
  img: string;
  title: string;
};

export async function fetchComic() {
  const response = await fetch('/info.0.json');
  if (!response.ok) {
    throw new Error('Request failed');
  }
  const data: APIResponseData = await response.json();
  return data;
}
