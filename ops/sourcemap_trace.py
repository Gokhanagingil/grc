#!/usr/bin/env python3
"""
Sourcemap Trace Tool

A node-free tool to resolve minified JavaScript stack traces to original source locations
using sourcemap files. Designed for use on staging/production hosts that have Python but not Node.

Usage:
    python3 ops/sourcemap_trace.py <path_to_js.map> <line> <column>

Example:
    python3 ops/sourcemap_trace.py /tmp/main.abc123.js.map 2 1690087

Requirements:
    - Python 3.6+
    - No external dependencies (uses only stdlib)

The script implements VLQ decoding and sourcemap parsing according to the Source Map v3 spec.
"""

import json
import sys
import os
from typing import Optional, Tuple, List, NamedTuple


class SourceMapping(NamedTuple):
    """Represents a decoded source mapping."""
    generated_line: int
    generated_column: int
    source_file: Optional[str]
    original_line: Optional[int]
    original_column: Optional[int]
    name: Optional[str]


# Base64 VLQ decoding
BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
BASE64_MAP = {char: i for i, char in enumerate(BASE64_CHARS)}

VLQ_BASE_SHIFT = 5
VLQ_BASE = 1 << VLQ_BASE_SHIFT  # 32
VLQ_BASE_MASK = VLQ_BASE - 1  # 31
VLQ_CONTINUATION_BIT = VLQ_BASE  # 32


def decode_vlq(encoded: str) -> List[int]:
    """Decode a VLQ-encoded string into a list of integers."""
    result = []
    shift = 0
    value = 0
    
    for char in encoded:
        if char not in BASE64_MAP:
            continue
        
        digit = BASE64_MAP[char]
        continuation = digit & VLQ_CONTINUATION_BIT
        digit &= VLQ_BASE_MASK
        value += digit << shift
        
        if continuation:
            shift += VLQ_BASE_SHIFT
        else:
            # Convert from VLQ signed representation
            is_negative = value & 1
            value = value >> 1
            if is_negative:
                value = -value
            result.append(value)
            value = 0
            shift = 0
    
    return result


def parse_mappings(mappings_str: str, sources: List[str], names: List[str]) -> List[SourceMapping]:
    """Parse the 'mappings' string from a sourcemap into SourceMapping objects."""
    result = []
    
    # State variables (these are relative/cumulative)
    generated_line = 0
    generated_column = 0
    source_index = 0
    original_line = 0
    original_column = 0
    name_index = 0
    
    # Split by lines (semicolons)
    lines = mappings_str.split(';')
    
    for line_mappings in lines:
        generated_column = 0  # Reset column for each new line
        
        if line_mappings:
            # Split by segments (commas)
            segments = line_mappings.split(',')
            
            for segment in segments:
                if not segment:
                    continue
                
                fields = decode_vlq(segment)
                
                if len(fields) >= 1:
                    generated_column += fields[0]
                
                source_file = None
                orig_line = None
                orig_col = None
                name = None
                
                if len(fields) >= 4:
                    source_index += fields[1]
                    original_line += fields[2]
                    original_column += fields[3]
                    
                    if 0 <= source_index < len(sources):
                        source_file = sources[source_index]
                    orig_line = original_line
                    orig_col = original_column
                
                if len(fields) >= 5:
                    name_index += fields[4]
                    if 0 <= name_index < len(names):
                        name = names[name_index]
                
                result.append(SourceMapping(
                    generated_line=generated_line,
                    generated_column=generated_column,
                    source_file=source_file,
                    original_line=orig_line,
                    original_column=orig_col,
                    name=name
                ))
        
        generated_line += 1
    
    return result


def find_mapping(mappings: List[SourceMapping], line: int, column: int) -> Optional[SourceMapping]:
    """Find the closest mapping for a given generated line and column."""
    # Filter to mappings on the target line
    line_mappings = [m for m in mappings if m.generated_line == line]
    
    if not line_mappings:
        # Try adjacent lines
        for offset in range(1, 5):
            line_mappings = [m for m in mappings if m.generated_line == line - offset]
            if line_mappings:
                print(f"[Note] No mappings on line {line}, using line {line - offset}")
                break
            line_mappings = [m for m in mappings if m.generated_line == line + offset]
            if line_mappings:
                print(f"[Note] No mappings on line {line}, using line {line + offset}")
                break
    
    if not line_mappings:
        return None
    
    # Sort by column
    line_mappings.sort(key=lambda m: m.generated_column)
    
    # Find the closest mapping at or before the target column
    best = None
    for mapping in line_mappings:
        if mapping.generated_column <= column:
            best = mapping
        else:
            break
    
    # If no mapping at or before, use the first one after
    if best is None and line_mappings:
        best = line_mappings[0]
    
    return best


def validate_sourcemap(filepath: str) -> Tuple[bool, str]:
    """Validate that a file is a valid sourcemap JSON."""
    if not os.path.exists(filepath):
        return False, f"File does not exist: {filepath}"
    
    file_size = os.path.getsize(filepath)
    if file_size == 0:
        return False, f"File is empty (0 bytes): {filepath}"
    
    # Check first character
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        first_char = f.read(1)
        if first_char != '{':
            return False, f"File does not start with '{{' (starts with '{first_char}'). Not valid JSON sourcemap."
    
    return True, "OK"


def main():
    if len(sys.argv) < 4:
        print("Usage: python3 sourcemap_trace.py <path_to_js.map> <line> <column>")
        print()
        print("Example:")
        print("  python3 ops/sourcemap_trace.py /tmp/main.abc123.js.map 2 1690087")
        print()
        print("To extract sourcemap from staging container:")
        print("  docker compose -f docker-compose.staging.yml exec -T frontend \\")
        print("    sh -lc 'cat /usr/share/nginx/html/static/js/main.<hash>.js.map' > /tmp/main.<hash>.js.map")
        sys.exit(1)
    
    map_path = sys.argv[1]
    try:
        line = int(sys.argv[2])
        column = int(sys.argv[3])
    except ValueError:
        print("Error: line and column must be integers")
        sys.exit(1)
    
    # Validate sourcemap file
    valid, message = validate_sourcemap(map_path)
    if not valid:
        print(f"Error: {message}")
        print()
        print("Troubleshooting:")
        print("  1. Ensure the file was extracted correctly from the container")
        print("  2. Check that the container path is correct: /usr/share/nginx/html/static/js/")
        print("  3. Verify the file hash matches the deployed bundle")
        sys.exit(1)
    
    print(f"Loading sourcemap: {map_path}")
    print(f"File size: {os.path.getsize(map_path):,} bytes")
    
    try:
        with open(map_path, 'r', encoding='utf-8') as f:
            sourcemap = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in sourcemap file: {e}")
        sys.exit(1)
    
    # Extract sourcemap components
    sources = sourcemap.get('sources', [])
    names = sourcemap.get('names', [])
    mappings_str = sourcemap.get('mappings', '')
    
    print(f"Sources: {len(sources)} files")
    print(f"Names: {len(names)} identifiers")
    print(f"Parsing mappings...")
    
    # Parse mappings
    mappings = parse_mappings(mappings_str, sources, names)
    print(f"Total mappings: {len(mappings):,}")
    
    # Find the mapping for the given position
    # Note: sourcemaps use 0-indexed lines, but stack traces often use 1-indexed
    # Try both interpretations
    print(f"\nLooking up generated position: line {line}, column {column}")
    
    # Try 0-indexed (line as-is, since sourcemaps are 0-indexed)
    mapping = find_mapping(mappings, line - 1, column)  # Convert 1-indexed to 0-indexed
    
    if mapping is None:
        # Try as 0-indexed directly
        mapping = find_mapping(mappings, line, column)
    
    if mapping:
        print("\n" + "=" * 60)
        print("ORIGINAL SOURCE LOCATION:")
        print("=" * 60)
        print(f"  File:   {mapping.source_file}")
        print(f"  Line:   {mapping.original_line + 1 if mapping.original_line is not None else 'N/A'}")  # Convert to 1-indexed
        print(f"  Column: {mapping.original_column + 1 if mapping.original_column is not None else 'N/A'}")  # Convert to 1-indexed
        if mapping.name:
            print(f"  Name:   {mapping.name}")
        print("=" * 60)
        
        # Show context: nearby mappings from the same source file
        if mapping.source_file:
            same_file_mappings = [
                m for m in mappings 
                if m.source_file == mapping.source_file 
                and m.original_line is not None
                and abs((m.original_line or 0) - (mapping.original_line or 0)) <= 5
            ]
            if same_file_mappings:
                print("\nNearby mappings in same file:")
                seen_lines = set()
                for m in sorted(same_file_mappings, key=lambda x: x.original_line or 0):
                    if m.original_line not in seen_lines:
                        seen_lines.add(m.original_line)
                        marker = " <-- TARGET" if m.original_line == mapping.original_line else ""
                        name_str = f" ({m.name})" if m.name else ""
                        print(f"  Line {(m.original_line or 0) + 1}{name_str}{marker}")
    else:
        print("\nNo mapping found for the specified position.")
        print("This could mean:")
        print("  1. The column offset doesn't match (different build)")
        print("  2. The code at that position is from a library/runtime")
        print("  3. The sourcemap is incomplete")
        
        # Show some stats about what's in the sourcemap
        if mappings:
            lines_with_mappings = set(m.generated_line for m in mappings)
            print(f"\nSourcemap has mappings for {len(lines_with_mappings)} generated lines")
            print(f"Generated lines range: {min(lines_with_mappings)} to {max(lines_with_mappings)}")


if __name__ == '__main__':
    main()
