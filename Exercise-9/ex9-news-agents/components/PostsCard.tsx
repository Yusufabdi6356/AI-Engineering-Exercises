import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';



type Post = {
    type: 'twitter' | 'linkedin';
    content: string;
    hashtags: string[];
  };
  
  type PostsCardProps = {
    posts: Post[];
  };

const PostsCard = ({posts}: PostsCardProps) => {
  return (
    <Card>
    <CardHeader>
      <CardTitle>Posts ({posts.length})</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4 max-h-96 overflow-auto">
        {posts.map((post, i) => (
          <div key={i} className="border p-3 rounded">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {post.type}
            </span>
            <p className="text-sm mt-2">{post.content}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {post.hashtags?.map((tag, j) => (
                <span key={j} className="text-xs text-gray-500">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
  )
}

export default PostsCard