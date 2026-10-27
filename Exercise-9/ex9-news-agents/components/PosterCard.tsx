'use client';
import { useState } from 'react'
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Poster = {
    url: string;
    prompt: string;
};

type PostersCardProps = {
    posters: Poster[];
};


const PosterCard = ({ posters }: PostersCardProps) => {

    const [expanded, setExpanded] = useState(false);

    if (!posters || posters.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Generated Poster</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500">No poster generated yet</p>
                </CardContent>
            </Card>
        );
    }


    const poster = posters[0];
    const isLongPrompt = poster.prompt.length > 150;
    const displayPrompt = expanded ? poster.prompt : poster.prompt.substring(0, 150);


    return (

        <Card>
            <CardHeader>
                <CardTitle>Generated Poster</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <Image
                        src={poster.url}
                        alt="Generated poster"
                        width={1024}
                        height={1024}
                        unoptimized
                        className="w-full h-auto rounded border"
                    />
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                            <strong>Prompt:</strong>
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {displayPrompt}
                            {isLongPrompt && !expanded && '...'}
                        </p>
                        {isLongPrompt && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpanded(!expanded)}
                                className="text-xs"
                            >
                                {expanded ? 'See Less' : 'See More'}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>

    )
}

export default PosterCard