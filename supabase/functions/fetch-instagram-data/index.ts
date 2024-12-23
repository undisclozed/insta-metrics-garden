import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username) {
      throw new Error('Username is required');
    }

    console.log('Fetching Instagram data for:', username);
    
    const apiKey = Deno.env.get('APIFY_API_KEY');
    if (!apiKey) {
      throw new Error('APIFY_API_KEY is not set');
    }

    console.log('APIFY_API_KEY length:', apiKey.length);

    // Using the correct Apify API endpoint for running an actor
    const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?token=${apiKey}`;

    // Simplified input to only fetch profile data
    const input = {
      usernames: [username],
      resultsLimit: 1,
      scrapePosts: false,
      scrapeStories: false,
      scrapeHighlights: false,
    };

    console.log('Making request to Apify URL:', apifyUrl);
    console.log('With input:', JSON.stringify(input));

    let runResponse;
    try {
      runResponse = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input)
      });

      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error('Apify API error response:', errorText);
        throw new Error(`Apify API returned status ${runResponse.status}: ${errorText}`);
      }
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      throw new Error(`Failed to make Apify API request: ${fetchError.message}`);
    }

    const runResult = await runResponse.json();
    console.log('Actor run started:', JSON.stringify(runResult, null, 2));

    if (!runResult.id) {
      console.error('Invalid run result:', runResult);
      throw new Error('Failed to get valid run ID from Apify');
    }

    // Poll for run completion
    const maxAttempts = 30;
    let attempts = 0;
    let runStatus;

    while (attempts < maxAttempts) {
      const statusUrl = `https://api.apify.com/v2/actor-runs/${runResult.id}?token=${apiKey}`;
      console.log(`Checking run status (attempt ${attempts + 1})...`);
      
      const statusResponse = await fetch(statusUrl);
      if (!statusResponse.ok) {
        throw new Error(`Failed to check run status: ${statusResponse.status}`);
      }
      
      runStatus = await statusResponse.json();
      console.log(`Run status:`, runStatus.status);

      if (runStatus.status === 'SUCCEEDED') {
        break;
      } else if (runStatus.status === 'FAILED' || runStatus.status === 'ABORTED') {
        throw new Error(`Actor run ${runStatus.status}: ${runStatus.errorMessage || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Actor run timed out');
    }

    if (!runStatus.defaultDatasetId) {
      throw new Error('Actor run completed, but no dataset was created');
    }

    // Fetch dataset
    const datasetUrl = `https://api.apify.com/v2/datasets/${runStatus.defaultDatasetId}/items?token=${apiKey}`;
    console.log('Fetching dataset from:', datasetUrl);
    
    const datasetResponse = await fetch(datasetUrl);
    if (!datasetResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
    }
    
    const dataset = await datasetResponse.json();
    console.log('Dataset fetched, raw data:', JSON.stringify(dataset, null, 2));

    return new Response(
      JSON.stringify({ data: dataset }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred',
        details: 'Check Supabase logs for more information'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});