import React from 'react'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { MAX_QUERY_LENGTH } from '@/lib/news'


type SearchInputProps = {
    input: string;
    error?: string;
    onInputChange: (value: string) => void;
    onRun: () => void;
    isRunning: boolean;
};


const SearchInput = ({
    input,
    error,
    onInputChange,
    onRun,
    isRunning
}: SearchInputProps
) => {

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle>Search News</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Input
                    placeholder="E.g., latest AI news, sports updates, tech trends..."
                    value={input}
                    maxLength={MAX_QUERY_LENGTH}
                    onChange={(e) => onInputChange(e.target.value)}
                    disabled={isRunning}
                    className="text-base"
                />

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                    onClick={onRun}
                    disabled={isRunning || !input.trim()}
                    className="w-full"
                >
                    {isRunning ? 'Running...' : 'Run Agents'}
                </Button>
            </CardContent>
        </Card>

    )
}

export default SearchInput
