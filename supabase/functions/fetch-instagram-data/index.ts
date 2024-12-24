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
    const { username } = await req.json()
    
    if (!username) {
      throw new Error('Username is required')
    }

    console.log('Processing request for username:', username)

    // Initialize API key
    const apiKey = Deno.env.get('APIFY_API_KEY')
    if (!apiKey) {
      throw new Error('APIFY_API_KEY is not set')
    }

    // Start the scraper run with correct input format (usernames as array)
    const runResponse = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs?token=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: [username.replace('@', '')], // Send as array and remove @ if present
          resultsLimit: 30,
          searchType: "user",
          searchLimit: 1
        })
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

    while (attempts < maxAttempts) {
      console.log(`Checking run status (attempt ${attempts + 1}/${maxAttempts})...`)
      
      const statusCheck = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs/${runData.data.id}?token=${apiKey}`
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
        const datasetResponse = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs/${runData.data.id}/dataset/items?token=${apiKey}`
        )
        
        if (!datasetResponse.ok) {
          throw new Error('Failed to fetch dataset')
        }

        dataset = await datasetResponse.json()
        break
      } else if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error(`Scraper run ${status.data.status.toLowerCase()}`)
      }

      attempts++
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    if (!dataset) {
      throw new Error('Failed to fetch data after maximum attempts')
    }

    // Transform data
    const transformedData = dataset.map(post => ({
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
        saves: post.savesCount || 0,
        shares: post.sharesCount || 0
      }
    }))

    console.log('Successfully transformed', transformedData.length, 'posts')

    return new Response(
      JSON.stringify({
        data: transformedData
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