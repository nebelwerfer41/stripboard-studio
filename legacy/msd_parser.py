#!/usr/bin/env python3
"""EPSF / Movie Magic Scheduling 6 read-only importer prototype, revision 2.
Python 3.9+, standard library only. Empirically verified against two supplied files.
Dates are inferred, not a certified implementation of Movie Magic's internals.
"""
import argparse
import base64
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zlib

FILE_MAGIC = b'/********* EPSF FILE ********/ '
SECTION_MAGIC = b'/********* EPSF SECTION *********/ '
MAP_MAGIC = b'/********* EPSF SECTION MAP *********/ '
MAX_FILE = 128 * 1024 * 1024
MAX_XML = 32 * 1024 * 1024
MAX_TOTAL_XML = 128 * 1024 * 1024
WEEKDAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
SCHEMA_VERSION = 'flash-msd-normalized/2.0'


class MsdError(ValueError):
    pass


def cstring(data):
    return data.split(b'\0', 1)[0].decode('utf-8')


def xml_node(node):
    """Keep attribute strings, child ordering, text and tail; no guessed coercion."""
    return {'tag': node.tag, 'attributes': dict(node.attrib), 'text': node.text,
            'tail': node.tail, 'children': [xml_node(c) for c in node]}


def read_container(path):
    path = Path(path)
    if path.stat().st_size > MAX_FILE:
        raise MsdError('File size limit exceeded')
    data = path.read_bytes()
    if len(data) < 716 or not data.startswith(FILE_MAGIC):
        raise MsdError('Not a supported EPSF file')
    map_offset, count = struct.unpack_from('>II', data, 260)
    if not 0 < count <= 1024 or map_offset < 716 or map_offset + count * 332 != len(data):
        raise MsdError('Invalid EPSF section map bounds or unsupported trailer')
    if cstring(data[64:128]) != '00.01.001' or cstring(data[192:256]) != '06.00.000':
        raise MsdError('Unsupported EPSF or schedule format version')
    sections, roots, xmls = [], {}, {}
    expected_offset, total = 716, 0
    for index in range(count):
        entry = data[map_offset + index * 332:map_offset + (index + 1) * 332]
        if entry[:68] != MAP_MAGIC.ljust(68, b'\0'):
            raise MsdError('Invalid section map record marker')
        offset, length = struct.unpack_from('>II', entry, 68)
        if offset != expected_offset or length <= 68 or offset + length > map_offset:
            raise MsdError('Invalid/non-contiguous/overlapping section bounds')
        expected_offset = offset + length
        block = data[offset:offset + length]
        if block[:68] != SECTION_MAGIC + b'\0' * 32 + b'\1':
            raise MsdError('Unsupported section compression header')
        dec = zlib.decompressobj(-15)
        try:
            raw = dec.decompress(block[68:], MAX_XML + 1)
        except zlib.error as exc:
            raise MsdError('Corrupt raw DEFLATE stream') from exc
        if len(raw) > MAX_XML or dec.unconsumed_tail or not dec.eof or dec.unused_data:
            raise MsdError('Oversized, truncated, or trailing section data')
        total += len(raw)
        if total > MAX_TOTAL_XML:
            raise MsdError('Total XML size limit exceeded')
        # UTF-8 only; reject DTD/entity declarations before handing data to XML parser.
        text = raw.decode('utf-8-sig')
        if re.search(r'<!\s*(DOCTYPE|ENTITY)\b', text, re.I):
            raise MsdError('DTD/entities are unsupported')
        try:
            root = ET.fromstring(text)
        except ET.ParseError as exc:
            raise MsdError('Invalid XML section') from exc
        if root.tag in roots or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.-]*', root.tag):
            raise MsdError('Duplicate or unsupported XML root')
        roots[root.tag], xmls[root.tag] = root, text
        sections.append({'index': index, 'mapName': cstring(entry[76:140]),
                         'mapType': cstring(entry[140:204]),
                         'version': cstring(entry[204:268]), 'root': root.tag,
                         'offset': offset, 'length': length,
                         'compressedBytes': length - 68, 'xmlBytes': len(raw),
                         'xmlSha256': hashlib.sha256(raw).hexdigest(),
                         'reservedHex': entry[268:].hex()})
    if expected_offset != map_offset:
        raise MsdError('Gap before section map')
    metadata = {'fileName': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                'epsfVersion': cstring(data[64:128]), 'fileType': cstring(data[128:192]),
                'formatVersion': cstring(data[192:256]),
                'writerApplication': cstring(data[268:332]), 'writerVersion': cstring(data[332:396]),
                'writerTimestampRaw': cstring(data[396:460]),
                'secondApplicationRaw': cstring(data[460:524]),
                'secondVersionRaw': cstring(data[524:588]),
                'secondTimestampRaw': cstring(data[588:652]),
                'headerBase64': base64.b64encode(data[:716]).decode(),
                'sectionMapOffset': map_offset, 'sectionCount': count, 'sections': sections}
    return metadata, roots, xmls


def iso_date(raw):
    try:
        return datetime.strptime(raw, '%m/%d/%Y').date().isoformat()
    except (ValueError, TypeError):
        return None


def issue(items, code, **context):
    items.append({'code': code, **context})


def unique_index(values, key, issues, label):
    result = {}
    for value in values:
        ident = key(value)
        if ident in result:
            raise MsdError(f'Ambiguous duplicate {label}: {ident!r}')
        result[ident] = value
    return result


def normalize_calendar(node, issues):
    name = node.get('Name')
    dates = {}
    for item in node.findall('./ScheduleDates/ScheduleDate'):
        key, raw = item.get('Name'), item.get('Date')
        if key in dates:
            raise MsdError(f'Duplicate schedule date {name!r}/{key!r}')
        dates[key] = {'raw': raw, 'iso': iso_date(raw)}
        if dates[key]['iso'] is None:
            issue(issues, 'INVALID_CALENDAR_DATE', calendar=name, field=key, raw=raw)
    off = node.find('DaysOff')
    days_off = dict(off.attrib) if off is not None else {}
    specials = []
    for item in node.findall('./SpecialDays/SpecialDay'):
        specials.append({'date': iso_date(item.get('Date')), 'attributes': dict(item.attrib)})
    start = dates.get('ProductionStartDate', {}).get('iso')
    wrap = dates.get('ProductionWrapDate', {}).get('iso')
    if start and wrap and wrap < start:
        issue(issues, 'WRAP_BEFORE_START', calendar=name, start=start, wrap=wrap)
    return {'name': name, 'scheduleDates': dates, 'daysOff': days_off, 'specialDays': specials,
            'source': xml_node(node)}


def day_status(calendar, current):
    """Return availability and reasons. Conflicting flags remain unresolved."""
    weekly = calendar['daysOff']
    if any(weekly.get(k) not in ('0', '1') for k in WEEKDAYS):
        return None, ['invalid-or-missing-weekly-flags']
    matches = [s for s in calendar['specialDays'] if s['date'] == current.isoformat()]
    if any(s['date'] is None for s in calendar['specialDays']):
        return None, ['invalid-special-day-date']
    if len(matches) > 1:
        return None, ['duplicate-special-day-date']
    attrs = matches[0]['attributes'] if matches else {}
    flags = ('Off', 'Holiday', 'CompanyTravel', 'ExceptionWorkday')
    if matches and any(attrs.get(k) not in ('0', '1') for k in flags):
        return None, ['invalid-special-day-flags']
    blocked = [k for k in flags[:3] if attrs.get(k) == '1']
    if attrs.get('ExceptionWorkday') == '1':
        if blocked:
            return None, ['conflicting-special-day-flags', *blocked]
        return True, ['ExceptionWorkday']
    if blocked:
        return False, blocked
    if weekly[WEEKDAYS[current.weekday()]] == '1':
        return False, ['DaysOff.' + WEEKDAYS[current.weekday()]]
    return True, ['regular-workday']


def derive_dates(calendar, count, max_scan_days=36600):
    """Ordinal ScheduleDay -> successive working date, inclusive of production start.
    No use of banners, stored end date, remaining strips, or unscheduled groups.
    """
    results, skipped, warnings = [], [], []
    start = calendar['scheduleDates'].get('ProductionStartDate', {}).get('iso')
    if not start:
        return [None] * count, [], [{'code': 'MISSING_START_DATE'}]
    current, scanned = date.fromisoformat(start), 0
    while len(results) < count and scanned < max_scan_days:
        available, reasons = day_status(calendar, current)
        scanned += 1
        if available is None:
            warnings.append({'code': 'AMBIGUOUS_CALENDAR_RULE', 'date': current.isoformat(), 'reasons': reasons})
            break
        if available:
            results.append({'date': current.isoformat(), 'basis': reasons, 'confidence': 'inferred'})
        else:
            skipped.append({'date': current.isoformat(), 'reasons': reasons})
        if current == date.max:
            break
        current += timedelta(days=1)
    if len(results) < count:
        warnings.append({'code': 'UNRESOLVED_SCHEDULE_DATES', 'resolved': len(results), 'requested': count})
        results.extend([None] * (count - len(results)))
    return results, skipped, warnings


def preferences(root):
    return [xml_node(c) for c in root if c.tag.endswith('Preferences')]


def normalize(path):
    metadata, roots, xmls = read_container(path)
    required = ('CalendarMgr', 'CategoryMgr', 'ElementMgr', 'BreakdownSheetMgr', 'StripBoardMgr')
    if any(k not in roots for k in required):
        raise MsdError('Missing required manager section')
    issues = []
    categories = [{'name': n.get('Name'), 'source': xml_node(n)}
                  for n in roots['CategoryMgr'].findall('./CategoryList/Category')]
    category_index = unique_index(categories, lambda x: x['name'], issues, 'category')
    elements = []
    for node in roots['ElementMgr'].findall('./Elements/Element'):
        category, name = node.get('CategoryName'), node.get('Name')
        elements.append({'key': [category, name], 'category': category, 'name': name,
                         'boardId': node.get('BoardID'), 'properties': [xml_node(p) for p in node.findall('Property')],
                         'linkedElements': [{'key': [p.get('CategoryName'), p.get('Name')],
                                             'anchorName': p.get('AnchorName'), 'attributes': dict(p.attrib)}
                                            for p in node.findall('./LinkedElements/LinkedElement')],
                         'source': xml_node(node)})
        if category not in category_index:
            issue(issues, 'MISSING_ELEMENT_CATEGORY', element=[category, name])
    element_index = unique_index(elements, lambda x: tuple(x['key']), issues, 'element key')
    linked_count = 0
    for element in elements:
        for link in element['linkedElements']:
            linked_count += 1
            link['resolved'] = tuple(link['key']) in element_index
            if not link['resolved']:
                issue(issues, 'MISSING_LINKED_ELEMENT', source=element['key'], target=link['key'])
    scenes, association_count = [], 0
    mapping = {'scene': 'Scenes', 'sheetNumber': 'SheetNumber', 'synopsis': 'Synopsis',
               'sequence': 'Sequence', 'ie': 'IE', 'dn': 'DN', 'set': 'Set', 'location': 'Location',
               'scriptDay': 'ScriptDay', 'scriptPageNumbers': 'ScriptPageNumbers', 'unit': 'Unit',
               'estimateTimeA': 'EstimateTimeA', 'estimateTimeB': 'EstimateTimeB', 'comments': 'Comments'}
    for node in roots['BreakdownSheetMgr'].findall('./BreakdownSheets/BreakdownSheet'):
        scene = {'bdsId': node.get('BDSID'), **{k: node.get(v) for k, v in mapping.items()}}
        raw_pages = node.get('NumScriptPages')
        scene['pagesEighths'] = int(raw_pages) if raw_pages and re.fullmatch(r'\d+', raw_pages) else None
        if scene['pagesEighths'] is None:
            issue(issues, 'UNPARSED_PAGE_COUNT', bdsId=scene['bdsId'], raw=raw_pages)
        requirements, refs = defaultdict(list), []
        for ref in node.findall('./ElementRefs/ElementRef'):
            association_count += 1
            key = (ref.get('CategoryName'), ref.get('ElementName'))
            resolved = key in element_index
            refs.append({'key': list(key), 'resolved': resolved, 'source': xml_node(ref)})
            requirements[key[0]].append(key[1])
            if not resolved:
                issue(issues, 'MISSING_SCENE_ELEMENT', bdsId=scene['bdsId'], element=list(key))
        scene.update(requirements=dict(requirements), elementRefs=refs, source=xml_node(node))
        scenes.append(scene)
    scene_index = unique_index(scenes, lambda x: x['bdsId'], issues, 'BDSID')
    calendars = [normalize_calendar(c, issues) for c in roots['CalendarMgr'].findall('./Calendars/Calendar')]
    calendar_index = unique_index(calendars, lambda x: x['name'], issues, 'calendar')
    default_node = roots['CalendarMgr'].find("./CalendarMgrPreferences/PropertyList/Property[@Name='DefaultCalendar']")
    default_calendar = default_node.get('Value') if default_node is not None else None
    if default_calendar not in calendar_index:
        issue(issues, 'MISSING_DEFAULT_CALENDAR', name=default_calendar)
    active_node = roots['StripBoardMgr'].find("./StripBoardMgrPreferences/PropertyList/Property[@Name='ActiveStripBoard']")
    active = active_node.get('Value') if active_node is not None else None
    boards = []

    def strips(node, board_name):
        result = []
        for item in node:
            entry = {'kind': {'BDSStrip': 'scene', 'BannerStrip': 'banner'}.get(item.tag, 'unknown'),
                     'source': xml_node(item)}
            if item.tag == 'BDSStrip':
                ident = item.get('BDSID')
                entry.update(bdsId=ident, resolved=ident in scene_index)
            elif item.tag == 'BannerStrip':
                entry['text'] = item.get('Text')
            else:
                issue(issues, 'UNKNOWN_STRIP_TYPE', board=board_name, tag=item.tag)
            result.append(entry)
        return result

    for node in roots['StripBoardMgr'].findall('./StripBoards/StripBoard'):
        name, cal_name = node.get('Name'), node.get('CalendarName')
        if cal_name not in calendar_index:
            issue(issues, 'MISSING_BOARD_CALENDAR', board=name, calendar=cal_name)
        board = {'name': name, 'calendarName': cal_name, 'description': node.findtext('Description', ''),
                 'attributes': dict(node.attrib), 'scheduledGroups': [], 'unscheduledGroups': []}
        days = node.findall('./ScheduledStrips/ScheduleDay')
        if cal_name in calendar_index:
            derived, skipped, date_warnings = derive_dates(calendar_index[cal_name], len(days))
        else:
            derived, skipped, date_warnings = [None] * len(days), [], []
        for warning in date_warnings:
            issues.append({**warning, 'board': name})
        day_index = 0
        for container_tag, key in [('ScheduledStrips', 'scheduledGroups'), ('UnscheduledStrips', 'unscheduledGroups')]:
            container = node.find(container_tag)
            if container is None:
                issue(issues, 'MISSING_STRIP_CONTAINER', board=name, tag=container_tag)
                continue
            for group in container:
                entry = {'kind': group.tag, 'attributes': dict(group.attrib), 'strips': strips(group, name),
                         'date': None, 'dateDerivation': None}
                if group.tag == 'ScheduleDay' and container_tag == 'ScheduledStrips':
                    derivation = derived[day_index]
                    entry.update(ordinal=day_index + 1, date=derivation['date'] if derivation else None,
                                 dateDerivation=derivation)
                    day_index += 1
                elif group.tag not in ('RemainingScheduledStrips', 'UnscheduledDay', 'RemainingUnscheduledStrips'):
                    issue(issues, 'UNKNOWN_STRIP_GROUP', board=name, tag=group.tag)
                board[key].append(entry)
        reference_counts = Counter(x.get('BDSID') for x in node.iter('BDSStrip'))
        dangling = sorted(set(reference_counts) - set(scene_index))
        missing = sorted(set(scene_index) - set(reference_counts))
        duplicates = {k: v for k, v in reference_counts.items() if v > 1}
        for code, value in [('DANGLING_BOARD_SCENES', dangling), ('SCENES_ABSENT_FROM_BOARD', missing),
                            ('REPEATED_BOARD_SCENES', duplicates)]:
            if value:
                issue(issues, code, board=name, ids=value)
        dates = [x['date'] for x in board['scheduledGroups'] if x['kind'] == 'ScheduleDay' and x['date']]
        stored_end = calendar_index.get(cal_name, {}).get('scheduleDates', {}).get('ProductionEndDate', {}).get('iso')
        board['dateAudit'] = {'method': 'successive-workdays-v1', 'confidence': 'inferred',
                              'firstDate': dates[0] if dates else None, 'lastDate': dates[-1] if dates else None,
                              'storedProductionEndDate': stored_end,
                              'lastDateMatchesStoredEnd': dates[-1] == stored_end if dates and stored_end else None,
                              'skippedDates': skipped}
        if dates and stored_end and dates[-1] != stored_end:
            issue(issues, 'STORED_END_DIFFERS_FROM_BOARD', board=name, derived=dates[-1], stored=stored_end)
        board['integrity'] = {'sceneOccurrences': sum(reference_counts.values()), 'uniqueScenes': len(reference_counts),
                              'danglingBdsIds': dangling, 'missingBdsIds': missing, 'repeatedBdsIds': duplicates}
        boards.append(board)
    unique_index(boards, lambda x: x['name'], issues, 'board')
    if active not in {b['name'] for b in boards}:
        issue(issues, 'MISSING_ACTIVE_BOARD', name=active)
    red_flags = []
    if 'RedFlagMgr' in roots:
        for node in roots['RedFlagMgr'].findall('./RedFlagEntryList/RedFlagEntry'):
            key = (node.get('Category'), node.get('Element'))
            resolved = key in element_index
            red_flags.append({'date': iso_date(node.get('Date')), 'elementKey': list(key),
                              'resolved': resolved, 'source': xml_node(node)})
            if not resolved:
                issue(issues, 'MISSING_REDFLAG_ELEMENT', key=list(key))
    counts = {'scenes': len(scenes), 'elements': len(elements), 'categories': len(categories),
              'calendars': len(calendars), 'stripboards': len(boards), 'sceneElementAssociations': association_count,
              'linkedElements': linked_count, 'redFlags': len(red_flags),
              'scheduleDays': sum(len(b['scheduledGroups']) - sum(g['kind'] != 'ScheduleDay' for g in b['scheduledGroups']) for b in boards),
              'unscheduledDays': sum(sum(g['kind'] == 'UnscheduledDay' for g in b['unscheduledGroups']) for b in boards)}
    return {'schemaVersion': SCHEMA_VERSION, 'source': metadata, 'activeStripBoard': active,
            'defaultCalendar': default_calendar, 'counts': counts, 'calendars': calendars,
            'categories': categories, 'elements': elements, 'scenes': scenes, 'stripboards': boards,
            'productionInfo': xml_node(roots['ProductionInfo']) if 'ProductionInfo' in roots else None,
            'redFlags': red_flags, 'managerPreferences': {k: preferences(roots[k]) for k in required},
            'validation': {'issues': issues, 'issueCounts': dict(Counter(x['code'] for x in issues))},
            'sourceXmlSections': xmls}


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--out-dir', type=Path, default=Path('outputs'))
    parser.add_argument('--extract-xml', action='store_true')
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for path in args.files:
        project = normalize(path)
        target = args.out_dir / (path.stem + '.normalized.json')
        write_json(target, project)
        if args.extract_xml:
            folder = args.out_dir / (path.stem + '.xml')
            folder.mkdir(exist_ok=True)
            for name, content in project['sourceXmlSections'].items():
                (folder / (name + '.xml')).write_text(content, encoding='utf-8')
        print(json.dumps({'output': str(target), 'counts': project['counts'],
                          'issues': project['validation']['issueCounts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
