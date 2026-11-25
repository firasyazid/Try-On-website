# TryOn

A Next.js App Router project for the TryOn website. The homepage contains the site header and interactive clothing rail.

## Run locally

Use Node.js 22 LTS (22.13 or newer) or 24 LTS. The Next.js runtime also supports Node.js 20.9. The lint toolchain requires a newer patch release on Node.js 20.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Use `npm run lint`, `npm run typecheck`, and `npm run build` to check changes.

## Photo try-on

Select a garment in `/showroom` and open **Try on**. The app submits the uploaded portrait and the selected garment’s front image to FASHN VTON v1.5. The browser displays the generated PNG and lets the visitor download it.

### Free prototype

Copy `.env.example` to `.env.local` and set `FASHN_PROVIDER=huggingface`. The app sends requests to [FASHN's public Hugging Face Space](https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5). Anonymous requests use a shared pool. An optional Hugging Face access token in server-only `HF_TOKEN` uses the account's [daily ZeroGPU quota](https://huggingface.co/docs/hub/spaces-zerogpu#usage-tiers). The public queue can fill up. Restart Next.js after changing these settings.

An eligible free Hugging Face account can [host a separate ZeroGPU Space](https://huggingface.co/docs/hub/spaces-zerogpu#using-and-hosting-zerogpu-spaces). Duplicate FASHN's Space and set `FASHN_SPACE_URL` to the new Space's HTTPS `hf.space` URL. This gives the app a separate queue within the same ZeroGPU limits.

### Private GPU worker

1. On the GPU host, activate a Python virtual environment with CUDA-enabled PyTorch. Follow the [FASHN weight download instructions](https://github.com/fashn-AI/fashn-vton-1.5#model-weights). If the host uses CUDA 12, install the corresponding [ONNX Runtime GPU build](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html).
2. Run the worker from the project root. Use a long, random shared token and set the weights directory to the one created in step 1.

   ```sh
   python -m pip install -r inference/requirements.txt
   export FASHN_INFERENCE_TOKEN="replace-with-your-shared-token"
   export FASHN_WEIGHTS_DIR="/path/to/weights"
   python -m uvicorn inference.app:app --host 127.0.0.1 --port 8000
   ```

3. Copy `.env.example` to `.env.local` in the Next.js project. Set `FASHN_PROVIDER=worker` and the same token, then restart Next.js. For a separate GPU host, set `FASHN_INFERENCE_URL` to its private HTTPS endpoint ending in `/try-on`. Set the proxy and app host request timeouts to allow up to 10 minutes for inference.

## Add the garment images

The rail uses transparent front and side cutouts from `public/images/`. To change the lineup, add the `.webp` or `.png` files and update the garment entry in `src/features/collection/garments.ts`.

Use centered portrait cutouts. Put the side view in `profileFilename` and the front view in `filename`. The rail presents the side view at rest and turns toward the front on hover, focus, or tap. Measure the distance from the top of the image to the neckline and from the neckline to the lowest visible hem or cuff. Divide each measurement by that image’s width. Use `necklineInset` and `visibleLength` for the front view and `profileInset` and `profileLength` for the side view.

For `frontCollar` and `profileCollar`, measure the opening’s horizontal center from the left edge, its top from the top edge, and the depth available for the visible hanger. Divide all three values by the source image width.

Each slot shows its garment tag until its image is present. Refresh the development page after adding files. For production, add the assets before building so the rendered page includes them.

## Project layout

- `src/app/` contains routes, site metadata, and shared design tokens.
- `src/components/` contains shared site components, starting with the header.
- `src/features/collection/` contains the garment catalog, server-side asset lookup, and the interactive rail.
- `public/images/` contains the garment images served by Next.js.

Edit `src/features/collection/garments.ts` to change garment names, colors, or display order. The route and asset lookup run on the server. The rail handles hover, keyboard focus, tap, and reduced-motion preferences in the browser.
