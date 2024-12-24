import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, debug } = await req.json()
    
    if (!username) {
      throw new Error('Username is required')
    }

    console.log('Starting Instagram data fetch for username:', username)
    
    const apiKey = Deno.env.get('APIFY_API_KEY')
    if (!apiKey) {
      throw new Error('APIFY_API_KEY is not set')
    }

    // Start the scraper run with full scraping options
    console.log('Starting scraper with username:', username)
    const input = {
      "usernames": [username],
      "resultsLimit": 30,
      "scrapePosts": true,
      "scrapeStories": true,
      "scrapeHighlights": true,
      "scrapeFollowers": true,
      "scrapeFollowing": true,
      "proxy": {
        "useApifyProxy": true
      }
    }
    console.log('Apify input:', JSON.stringify(input, null, 2))

    const runResponse = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?token=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    )

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('Run response error:', errorText)
      throw new Error(`Failed to start scraper: ${errorText}`)
    }

    const runData = await runResponse.json()
    console.log('Scraper started with run ID:', runData.data.id)

    // Poll for completion
    let attempts = 0
    const maxAttempts = 24 // 2 minutes maximum wait
    let dataset = null
    let rawApifyResponse = null

    while (attempts < maxAttempts) {
      console.log(`Checking run status (attempt ${attempts + 1}/${maxAttempts})...`)
      
      const statusCheck = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs/${runData.data.id}?token=${apiKey}`
      )
      
      if (!statusCheck.ok) {
        console.error('Status check failed:', await statusCheck.text())
        attempts++
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }

      const status = await statusCheck.json()
      console.log('Run status:', status.data.status)

      if (status.data.status === 'SUCCEEDED') {
        console.log('Fetching dataset...')
        const datasetResponse = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs/${runData.data.id}/dataset/items?token=${apiKey}`
        )
        
        if (!datasetResponse.ok) {
          const errorText = await datasetResponse.text()
          console.error('Dataset fetch error:', errorText)
          throw new Error('Failed to fetch dataset')
        }

        const datasetText = await datasetResponse.text()
        console.log('Raw dataset response:', datasetText)
        
        try {
          rawApifyResponse = JSON.parse(datasetText)
          dataset = rawApifyResponse
            .filter((post: any) => post && (post.type === 'Video' || post.type === 'Photo'))
            .map((post: any) => ({
              id: post.id || `temp-${Date.now()}-${Math.random()}`,
              username: post.ownerUsername || username,
              thumbnail: post.displayUrl || '',
              caption: post.caption || '',
              timestamp: post.timestamp || new Date().toISOString(),
              metrics: {
                views: post.videoViewCount || 0,
                likes: post.likesCount || 0,
                comments: post.commentsCount || 0,
                engagement: ((post.likesCount || 0) + (post.commentsCount || 0)) / 100,
                saves: 0,
                shares: 0,
              }
            }))
          console.log('Successfully transformed', dataset.length, 'posts')
          break
        } catch (error) {
          console.error('Failed to parse dataset:', error)
          throw new Error('Failed to parse dataset')
        }
      } else if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error(`Scraper run ${status.data.status.toLowerCase()}`)
      }

      attempts++
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    if (!dataset) {
      throw new Error('Failed to fetch data after maximum attempts')
    }

    return new Response(
      JSON.stringify({
        data: dataset,
        ...(debug ? { rawApifyResponse } : {})
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Check the function logs for more information'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    )
  }
})