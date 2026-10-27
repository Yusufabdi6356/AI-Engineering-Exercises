import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Sentiment = {
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
    reasoning: string;
};

type SentimentsCardProps = {
    sentiments: Sentiment[];
};


export default function SentimentCard({ sentiments }: SentimentsCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Sentiments ({sentiments.length})</CardTitle>
            </CardHeader>

            <CardContent>
                <div className="space-y-3 max-h-96 overflow-auto">
                    {sentiments.map((s, i) => (
                        <div key={i} className="border p-3 rounded">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">Article {i + 1}</span>
                                <span className={`text-xs px-2 py-1 rounded ${s.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                        s.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {s.sentiment} ({s.score?.toFixed(2)})
                                </span>
                            </div>
                            <p className="text-xs text-gray-600">{s.reasoning}</p>
                        </div>
                    ))}
                </div>
            </CardContent>

        </Card>
    )
}