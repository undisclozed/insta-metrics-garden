import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { posts } from "@/components/post-comparison/mock-data";
import { PostSection } from "@/components/post-comparison/PostSection";

const postImages = [
  "https://images.unsplash.com/photo-1509440159596-0249088772ff",
  "https://images.unsplash.com/photo-1549931319-a545dcf3bc73",
  "https://images.unsplash.com/photo-1486427944299-d1955d23e34d",
  "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907",
  "https://images.unsplash.com/photo-1495147466023-ac5c588e2e94",
  "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81",
];

const generateMockPosts = () => {
  return Array.from({ length: 34 }, (_, index) => ({
    id: index + 1,
    thumbnail: postImages[index % postImages.length],
    caption: `${[
      "Sunday baking session! Finally achieved that perfect ear on my sourdough 🌾 The crumb is so open and airy! #HomeBaker #SourdoughBread",
      "First attempt at laminating dough for croissants - look at those layers! 72-hour ferment was worth the wait 🥐 #BakingJourney",
      "Weekly meal prep: Two loaves of whole wheat, one rye, and cinnamon rolls because we deserve treats 🍞 #BreadBaking",
      "Testing a new pie crust recipe - all butter, extra flaky! The secret is keeping everything COLD 🥧 #BakingFromScratch",
      "Simple pleasures: Fresh sourdough and coffee for breakfast. The morning light was too perfect not to share ☕️ #MorningBakes",
      "When the crumb structure hits just right 👌 Three days of patience for this open crumb! #BreadGoals"
    ][index % 6]}`,
    timestamp: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
    metrics: {
      views: Math.floor(Math.random() * 50000) + 10000,
      likes: Math.floor(Math.random() * 5000) + 500,
      comments: Math.floor(Math.random() * 300) + 50,
      shares: Math.floor(Math.random() * 100) + 20,
      saves: Math.floor(Math.random() * 500) + 100,
      engagement: (Math.random() * 5 + 5).toFixed(1)
    }
  }));
};

const Posts = () => {
  const [mockPosts, setMockPosts] = useState(generateMockPosts());

  useEffect(() => {
    setMockPosts(generateMockPosts());
  }, []);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Recent Posts</h2>
        <PostSection posts={mockPosts} />
      </Card>
    </div>
  );
};

export default Posts;
