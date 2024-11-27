import {Toaster} from 'react-hot-toast';
import {QueryClient, QueryClientProvider} from 'react-query';

import {appWithTranslation} from 'next-i18next';
import type {AppProps} from 'next/app';
import {Inter} from 'next/font/google';

import '@/styles/globals.css';
import Head from "next/head";
import {SelectedImageProvider} from "@/components/GalleryBar/SelectedImageContext";

const inter = Inter({subsets: ['latin']});

function App({Component, pageProps}: AppProps<{}>) {
    const queryClient = new QueryClient();

    return (
        <div className={inter.className}>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
            </Head>
            <Toaster/>
            <QueryClientProvider client={queryClient}>
                <SelectedImageProvider>
                    <Component {...pageProps} />
                </SelectedImageProvider>
            </QueryClientProvider>
        </div>
    );
}

export default appWithTranslation(App);
