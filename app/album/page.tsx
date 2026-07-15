import { AlbumBrowser } from "./_components/album-browser";

type AlbumPageProps = {
  searchParams?: Promise<{
    section?: string | string[];
  }>;
};

export default async function AlbumPage({ searchParams }: AlbumPageProps) {
  const params = await searchParams;
  const section = Array.isArray(params?.section)
    ? params?.section[0]
    : params?.section;

  return <AlbumBrowser initialSection={section} />;
}
