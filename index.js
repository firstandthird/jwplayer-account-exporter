import config from "./config.json" assert { type: "json" };
import { mkdirp } from "mkdirp";
import m3u8ToMp4 from "m3u8-to-mp4";
import api from "api";
import pMap from "p-map";

const sdk = api("@jwp-platform/v1.0#ny7pq12le7jplsf");
sdk.auth(config.token);

const converter = new m3u8ToMp4();

(async function () {
  await pMap(
    config.sites,
    async (site) => {
      const mediaMap = [];

      try {
        console.info(`Processing site: ${site.id} - ${site.name}`);
        const sitePath = `${site.id} - ${site.name}`;
        await mkdirp(`${config.path}/${sitePath}`);
        const { data } = await sdk.getV2SitesSite_idMedia({
          page: "1",
          page_length: "10000",
          sort: "created%3Adsc",
          site_id: site.id,
        });

        data.media.forEach((media) => {
          if (media?.id && media?.media_type === "video") {
            mediaMap.push({
              id: media.id,
              title: media?.metadata?.title || media.id,
            });
          }
        });

        await pMap(
          mediaMap,
          async (mediaItem) => {
            console.info(
              `  - Downloading video: ${mediaItem.id} - ${mediaItem.title}`
            );
            await converter
              .setInputFile(
                `https://cdn.jwplayer.com/manifests/${mediaItem.id}.m3u8`
              )
              .setOutputFile(
                `${config.path}/${sitePath}/${mediaItem.id} - ${mediaItem.title}.mp4`
              )
              .start();
          },
          { concurrency: config.parallelDownloads }
        );
      } catch (err) {
        console.error({ err, site });
      }
    },
    { concurrency: 1 }
  );

  console.info(`Finished processing, files located in: ${config.path}`);
})();
